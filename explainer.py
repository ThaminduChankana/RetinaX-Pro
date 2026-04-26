import cv2
import logging
import PIL.Image
import numpy as np
import tensorflow as tf
import os

logger = logging.getLogger("RetinaX")


def generate_smoothgrad_heatmap(serve_fn, output_key, image_path, true_label_idx,
                                n_samples=30, noise_level=0.15, infer_size=(224, 224),
                                normalized_input_model=False):
    """
    SmoothGrad saliency (Smilkov et al. 2017): averages input gradients
    over N noisy copies of the image.

    ~100x faster than occlusion sensitivity:
      - SmoothGrad: 30 forward+backward passes ≈ 3-5 seconds
      - Occlusion:  3,136 forward-only passes  ≈ 3-5 minutes

    Produces pixel-level resolution instead of blocky 8×8 patch maps.

    OCT-specific: uses absolute gradient magnitudes to capture both
    bright hyperreflective structures (drusen, CNV membranes) AND dark
    fluid pockets (cystoid spaces in DME, subretinal fluid in CSR).

    Args:
        serve_fn:        TF serving function (model.signatures['serving_default'])
        output_key:      Key for the scores tensor in the model output dict
        image_path:      Path to the OCT image
        true_label_idx:  Index of the disease class (0 for [DISEASE, NORMAL])
        n_samples:       Number of noisy copies to average (default 30)
        noise_level:     Gaussian noise std as fraction of image range (default 0.15)
        infer_size:      Model input resolution (W, H)
        normalized_input_model: True for ConvNeXt-L/EfficientNetV2-L/Swin V2 exports (inputs=keyword, 0-1 range).
                         False for custom local models (positional call, 0-255 range).

    Returns:
        (PIL.Image, np.ndarray): original PIL image and normalized heatmap [0,1]
    """
    W, H = infer_size

    image = PIL.Image.open(image_path).resize(infer_size)
    if image.mode != 'RGB':
        image = image.convert('RGB')
    img_array = np.array(image, dtype=np.float32)  # [0, 255] range

    # ConvNeXt-L + EfficientNetV2-L + Swin V2 exports expect normalized [0, 1] input
    img_norm = img_array / 255.0 if normalized_input_model else img_array

    stdev = noise_level * (img_norm.max() - img_norm.min() + 1e-8)
    accumulated_grads = np.zeros((H, W, 3), dtype=np.float64)
    valid_samples = 0

    for _ in range(n_samples):
        noise = np.random.normal(0, stdev, img_norm.shape).astype(np.float32)
        noisy_img = np.clip(img_norm + noise, 0.0, 1.0 if normalized_input_model else 255.0)

        input_tensor = tf.convert_to_tensor(noisy_img[np.newaxis, :, :, :])

        with tf.GradientTape() as tape:
            tape.watch(input_tensor)
            # ConvNeXt-L + EfficientNetV2-L + Swin V2 ConcreteFunction requires the 'inputs=' keyword argument
            if normalized_input_model:
                prediction = serve_fn(inputs=input_tensor)
            else:
                prediction = serve_fn(input_tensor)
            target_score = prediction[output_key][0][true_label_idx]

        grads = tape.gradient(target_score, input_tensor)
        if grads is not None:
            accumulated_grads += grads.numpy()[0]
            valid_samples += 1

    if valid_samples == 0:
        logger.warning("SmoothGrad returned no valid gradients — model may not be differentiable")
        return image, np.zeros((H, W), dtype=np.float32)

    avg_grads = accumulated_grads / valid_samples
    # Absolute value (both +/- gradients indicate importance) → collapse RGB channels
    heatmap = np.abs(avg_grads).mean(axis=-1).astype(np.float32)

    if heatmap.max() > 0:
        heatmap = heatmap / heatmap.max()

    return image, heatmap


def _detect_retinal_band_mask(img_gray, H, W):
    """
    Locates the bright retinal tissue band in an OCT B-scan using
    per-row mean intensity + Otsu thresholding.

    Returns a uint8 mask (1 = inside retinal band, 0 = vitreous/choroid/sclera).
    Used to restrict the impact metric to anatomically relevant tissue only.
    """
    row_means = img_gray.mean(axis=1).astype(np.uint8)

    _, otsu_thresh = cv2.threshold(row_means, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    bright_rows = np.where(row_means >= otsu_thresh)[0]

    if len(bright_rows) == 0:
        top, bot = int(H * 0.20), int(H * 0.80)
    else:
        margin = int(H * 0.15)
        top = max(0, int(bright_rows[0]) - margin)
        bot = min(H, int(bright_rows[-1]) + margin)

    band_mask = np.zeros((H, W), dtype=np.uint8)
    band_mask[top:bot, :] = 1
    return band_mask


def extract_opencv_metrics(original_image_path, heatmap, save_dest_path):
    """
    Renders a clinical-style saliency overlay and computes retinal burden.

    Reads the original full-resolution image from disk so the overlay is not
    limited to the 224×224 inference resolution.

    Visualization:
    - Smooth JET colormap blended over the scan ONLY within the detected
      retinal band. Vitreous and deep choroid show the unmodified original.

    Impact metric (area-based retinal burden):
      - Restrict to the detected retinal band.
      - Adaptive threshold: pixels with saliency > 2× mean saliency within
        the band are counted as pathologically salient.
      - Impact % = (affected pixel count) / (retinal band area) × 100
    """
    original_pil = PIL.Image.open(original_image_path)
    if original_pil.mode != 'RGB':
        original_pil = original_pil.convert('RGB')
    img_cv = cv2.cvtColor(np.array(original_pil), cv2.COLOR_RGB2BGR)
    img_gray = cv2.cvtColor(np.array(original_pil), cv2.COLOR_RGB2GRAY)
    W, H = original_pil.size

    # 1. Resize heatmap to full resolution and smooth
    #    Scale Gaussian kernel proportionally (base: 15px at 224px width)
    scale_factor = W / 224.0
    kernel_size = int(15 * scale_factor)
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel_size = max(3, kernel_size)

    heatmap_resized = cv2.resize(heatmap, (W, H), interpolation=cv2.INTER_CUBIC)
    heatmap_resized = cv2.GaussianBlur(heatmap_resized, (kernel_size, kernel_size), 0)

    # 2. Detect retinal band — exclude vitreous and deep choroid
    band_mask = _detect_retinal_band_mask(img_gray, H, W)

    # 3. Compute retinal burden: adaptive threshold on saliency within band
    #    Pixels with saliency > 2× mean are considered pathologically salient.
    #    This adapts to each image's saliency distribution and produces
    #    clinically reasonable burden values (typically 5-30% for moderate disease).
    heatmap_in_band = heatmap_resized * band_mask.astype(np.float32)
    band_max = heatmap_in_band.max()
    if band_max > 0:
        band_pixels = heatmap_in_band[band_mask == 1]
        band_mean = float(band_pixels.mean())
        threshold = 2.0 * band_mean
        affected_gate = (heatmap_in_band > threshold) & (band_mask == 1)
        gated_pixel_count = int(affected_gate.sum())
        retinal_band_area = max(int(band_mask.sum()), 1)
        impact_percentage = round(float((gated_pixel_count / retinal_band_area) * 100), 2)
    else:
        impact_percentage = 0.0

    # 4. Render: JET overlay restricted to retinal band (original image elsewhere)
    heatmap_masked = heatmap_resized * band_mask.astype(np.float32)
    heatmap_8u = np.uint8(255 * heatmap_masked)
    heatmap_color = cv2.applyColorMap(heatmap_8u, cv2.COLORMAP_JET)
    blended = cv2.addWeighted(img_cv, 0.55, heatmap_color, 0.45, 0)
    band_mask_3c = np.stack([band_mask, band_mask, band_mask], axis=-1)
    overlay = np.where(band_mask_3c == 1, blended, img_cv)

    heatmap_filename = "heatmap_" + os.path.basename(save_dest_path)
    final_save_path = os.path.join(os.path.dirname(save_dest_path), heatmap_filename)
    cv2.imwrite(final_save_path, overlay)

    return final_save_path, impact_percentage


def _detect_fundus_roi_mask(img_gray, H, W):
    """
    Detects the circular fundus region in a fundus photograph by
    thresholding intensity to separate the retinal disc from the
    black background corners.

    Returns a uint8 mask (1 = fundus tissue, 0 = background).
    """
    # Gaussian blur to reduce noise
    blurred = cv2.GaussianBlur(img_gray, (15, 15), 0)

    # Threshold: fundus tissue is brighter than black corners
    # Use Otsu's method for adaptive thresholding
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Morphological operations to clean up the mask
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Find the largest contour (the fundus disc)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros((H, W), dtype=np.uint8)

    if contours:
        largest = max(contours, key=cv2.contourArea)
        cv2.drawContours(mask, [largest], -1, 1, thickness=cv2.FILLED)
    else:
        # Fallback: use central 80% circle
        center = (W // 2, H // 2)
        radius = int(min(H, W) * 0.4)
        cv2.circle(mask, center, radius, 1, thickness=cv2.FILLED)

    return mask


def extract_fundus_opencv_metrics(original_image_path, heatmap, save_dest_path):
    """
    Renders a clinical-style saliency overlay for fundus images and
    computes retinal burden within the fundus disc region.

    Uses _detect_fundus_roi_mask instead of _detect_retinal_band_mask.
    """
    original_pil = PIL.Image.open(original_image_path)
    if original_pil.mode != 'RGB':
        original_pil = original_pil.convert('RGB')
    img_cv = cv2.cvtColor(np.array(original_pil), cv2.COLOR_RGB2BGR)
    img_gray = cv2.cvtColor(np.array(original_pil), cv2.COLOR_RGB2GRAY)
    W, H = original_pil.size

    # 1. Resize heatmap to full resolution and smooth
    scale_factor = W / 224.0
    kernel_size = int(15 * scale_factor)
    if kernel_size % 2 == 0:
        kernel_size += 1
    kernel_size = max(3, kernel_size)

    heatmap_resized = cv2.resize(heatmap, (W, H), interpolation=cv2.INTER_CUBIC)
    heatmap_resized = cv2.GaussianBlur(heatmap_resized, (kernel_size, kernel_size), 0)

    # 2. Detect fundus disc region
    fundus_mask = _detect_fundus_roi_mask(img_gray, H, W)

    # 3. Compute retinal burden within fundus disc
    heatmap_in_disc = heatmap_resized * fundus_mask.astype(np.float32)
    disc_max = heatmap_in_disc.max()
    if disc_max > 0:
        disc_pixels = heatmap_in_disc[fundus_mask == 1]
        disc_mean = float(disc_pixels.mean())
        threshold = 2.0 * disc_mean
        affected_gate = (heatmap_in_disc > threshold) & (fundus_mask == 1)
        gated_pixel_count = int(affected_gate.sum())
        fundus_disc_area = max(int(fundus_mask.sum()), 1)
        impact_percentage = round(float((gated_pixel_count / fundus_disc_area) * 100), 2)
    else:
        impact_percentage = 0.0

    # 4. Render: JET overlay restricted to fundus disc
    heatmap_masked = heatmap_resized * fundus_mask.astype(np.float32)
    heatmap_8u = np.uint8(255 * heatmap_masked)
    heatmap_color = cv2.applyColorMap(heatmap_8u, cv2.COLORMAP_JET)
    blended = cv2.addWeighted(img_cv, 0.55, heatmap_color, 0.45, 0)
    fundus_mask_3c = np.stack([fundus_mask, fundus_mask, fundus_mask], axis=-1)
    overlay = np.where(fundus_mask_3c == 1, blended, img_cv)

    heatmap_filename = "heatmap_" + os.path.basename(save_dest_path)
    final_save_path = os.path.join(os.path.dirname(save_dest_path), heatmap_filename)
    cv2.imwrite(final_save_path, overlay)

    return final_save_path, impact_percentage


def generate_fundus_explainability(serve_fn, output_key, image_path, true_label_idx, infer_size=(224, 224)):
    """
    Master function for fundus explainability, called by Helper.py.
    Uses fundus-specific ROI mask instead of OCT retinal band mask.

    Fundus base model is a ConvNeXt-L + EfficientNetV2-L + Swin V2 export — pass normalized_input_model=True
    so SmoothGrad normalizes input to [0,1] and uses the 'inputs=' keyword arg.
    """
    logger.info("Saliency engine   │ Starting SmoothGrad analysis (Fundus)")

    _pil_img, raw_heatmap = generate_smoothgrad_heatmap(
        serve_fn, output_key, image_path, true_label_idx, infer_size=infer_size,
        normalized_input_model=True
    )

    heatmap_path, impact_percentage = extract_fundus_opencv_metrics(
        image_path, raw_heatmap, image_path
    )

    logger.info(f"Saliency engine   │ Fundus Burden: {impact_percentage:.2f}%")

    return heatmap_path, impact_percentage


def generate_explainability(serve_fn, output_key, image_path, true_label_idx, infer_size=(224, 224)):
    """
    Master function called by Helper.py.

    Args:
        serve_fn:        TF serving function for the disease detection model
        output_key:      Output dict key for the scores tensor
        image_path:      Path to the OCT image
        true_label_idx:  Disease class index (0 for [DISEASE, NORMAL])
        infer_size:      Model input resolution (W, H)
    """
    logger.info("Saliency engine   │ Starting SmoothGrad analysis")

    _pil_img, raw_heatmap = generate_smoothgrad_heatmap(
        serve_fn, output_key, image_path, true_label_idx, infer_size=infer_size
    )

    heatmap_path, impact_percentage = extract_opencv_metrics(
        image_path, raw_heatmap, image_path
    )

    logger.info(f"Saliency engine   │ Retinal Burden: {impact_percentage:.2f}%")

    return heatmap_path, impact_percentage
