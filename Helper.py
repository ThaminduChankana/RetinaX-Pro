"""
RetinaX Diagnostic Pipeline — Helper Module
=============================================
Orchestrates the cascaded inference pipeline:
  Step 1: Consensus hybrid classification (CoAtNet + DINOv2 + ResNeSt consensus; ConvNeXt-L + EfficientNetV2-L + Swin V2 base)
  Step 2: DME/DR disambiguation (if needed)
  Step 3: Severity grading + Explainability + Clinical LLM report

Optimizations:
  - Lazy model loading: TF SavedModels loaded on first use, then cached
  - Structured logging with consistent formatting
"""

import io
import logging
import os
import time

import numpy as np
import PIL.Image
import tensorflow as tf

# ══════════════════════════════════════════════════════════════════════
#  LOGGING CONFIGURATION
# ══════════════════════════════════════════════════════════════════════
logger = logging.getLogger("RetinaX")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        "%(asctime)s │ %(levelname)-7s │ %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logger.propagate = False  # Prevent duplicate output via Flask's root logger

# Silence noisy TF/absl/werkzeug logs
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
logging.getLogger("absl").setLevel(logging.WARNING)
logging.getLogger("werkzeug").setLevel(logging.WARNING)

# ══════════════════════════════════════════════════════════════════════
#  PREDICT FUNCTION IMPORTS (lightweight — no model loading at import)
# ══════════════════════════════════════════════════════════════════════
from OCT_Detection.Base_OCT_Classifier.predict import main_disease_prediction
from OCT_Detection.DME_DR_OCT_Discriminator.predict import main_dme_dr

import explainer
import clinical_llm


# ══════════════════════════════════════════════════════════════════════
#  MODEL CACHE — Lazy loading with LRU-style caching
# ══════════════════════════════════════════════════════════════════════
_model_cache = {}  # {directory_path: (tf_model, serve_fn)}


def _get_cached_model(model_dir):
    """Load a TF SavedModel once and cache it. Returns (model, serve_fn)."""
    if model_dir not in _model_cache:
        model_pb = os.path.join(model_dir, "saved_model.pb")
        if not os.path.exists(model_pb):
            return None, None
        t0 = time.perf_counter()
        model = tf.saved_model.load(str(model_dir))
        serve = model.signatures['serving_default']
        _model_cache[model_dir] = (model, serve)
        dt = time.perf_counter() - t0
        logger.info(f"Model loaded: {os.path.basename(model_dir):>20s}  ({dt:.1f}s)")
    return _model_cache[model_dir]


# ══════════════════════════════════════════════════════════════════════
#  MODEL PATHS & CLASS INDICES
# ══════════════════════════════════════════════════════════════════════
BASE_CLASSIFIER_MODEL   = "OCT_Detection/Base_OCT_Classifier/saved_model.pb"
CONSENSUS_OCT_MODEL      = "OCT_Detection/Consensus_OCT_Classifier"
DME_DR_MODEL            = "OCT_Detection/DME_DR_OCT_Discriminator"   # Proprietary Edge discriminator
ARMD_CNV_MODEL          = "OCT_Detection/ARMD_CNV_Discriminator"  # Proprietary Edge discriminator

DISEASE_LABELS = ["ARMD", "CNV", "CSR", "DME", "DR", "MH", "NORMAL"]
DISEASE_CLASS_INDEX = {label: i for i, label in enumerate(DISEASE_LABELS)}

# DR severity → Macular Thickening rename map
_DR_MACULAR_MAP = {
    "Mild":     "Mild Macular Thickening",
    "Moderate": "Moderate Macular Thickening",
    "Severe":   "Severe Macular Thickening",
}

# ── Display label formatters ──────────────────────────────────────────
_DISEASE_DISPLAY = {
    "ARMD":         "Age-Related Macular Degeneration",
    "CNV":          "Choroidal Neovascularization",
    "CSR":          "Central Serous Retinopathy",
    "DME":          "Diabetic Macular Edema",
    "DR":           "Diabetic Retinopathy",
    "MH":           "Macular Hole",
    "NORMAL":       "Normal",
    "Normal":       "Normal",
    "Cataract":     "Cataract",
    "Glaucoma":     "Glaucoma",
    "Hypertension": "Hypertensive Retinopathy",
}

_SEVERITY_DISPLAY = {
    # Fundus ARMD
    "Dry_ARMD":                 "Dry ARMD",
    "Wet_ARMD":                 "Wet ARMD",
    # Fundus Cataract
    "Mild_Cataract":            "Mild",
    "Moderate_Cataract":        "Moderate",
    "Severe_Cataract":          "Severe",
    # Fundus DR
    "Non_Referable":            "Non-Referable DR",
    "Proliferative_DR":         "Proliferative DR",
    "Referable_NPDR":           "Referable NPDR",
    # Fundus Glaucoma
    "Referable_Glaucoma":       "Referable Glaucoma",
    "Suspect_Glaucoma":         "Suspect Glaucoma",
    # Fundus Hypertension
    "Early_Hypertension":       "Early Hypertension",
    "Hypertensive_Retinopathy": "Hypertensive Retinopathy",
}


def _fmt_disease(label):
    """Return human-readable disease name for display."""
    return _DISEASE_DISPLAY.get(label, label)


def _fmt_severity(label):
    """Return human-readable severity label for display.
    Falls back to replacing underscores with spaces for unmapped labels.
    """
    return _SEVERITY_DISPLAY.get(label, label.replace("_", " "))


def _fmt_scores(scores):
    """Rename disease_scores keys to display names (keeps chart labels consistent)."""
    return {_fmt_disease(k): v for k, v in scores.items()}

# ── Fundus pipeline constants ──
MODALITY_MODEL = "Modality_Model_Edge"
FUNDUS_BASE_MODEL      = "Fundus_Detection/Base_Fundus_Classifier"
CONSENSUS_FUNDUS_MODEL = "Fundus_Detection/Consensus_Fundus_Classifier"

# Fundus discriminators — 5 pairwise Edge models, each covering 3 classes.
# Combined-ensemble mode: all installed models run on every uncertain image;
# per-class scores are averaged across models that include that class, then
# the class with the highest average wins.
_FUNDUS_DISC_MODELS = [
    {
        "key":     "DR_Glaucoma_Cataract",
        "dir":     "Fundus_Detection/Discriminators/DR_Glaucoma_Cataract",
        "classes": {"DR", "Glaucoma", "Cataract"},
    },
    {
        "key":     "DR_Glaucoma_Normal",
        "dir":     "Fundus_Detection/Discriminators/DR_Glaucoma_Normal",
        "classes": {"DR", "Glaucoma", "Normal"},
    },
    {
        "key":     "Glaucoma_Cataract_Normal",
        "dir":     "Fundus_Detection/Discriminators/Glaucoma_Cataract_Normal",
        "classes": {"Glaucoma", "Cataract", "Normal"},
    },
    {
        "key":     "ARMD_DR_Normal",
        "dir":     "Fundus_Detection/Discriminators/ARMD_DR_Normal",
        "classes": {"ARMD", "DR", "Normal"},
    },
    {
        "key":     "HT_DR_Glaucoma",
        "dir":     "Fundus_Detection/Discriminators/HT_DR_Glaucoma",
        "classes": {"Hypertension", "DR", "Glaucoma"},
    },
]
FUNDUS_DISEASE_LABELS = ["ARMD", "Cataract", "DR", "Glaucoma", "Hypertension", "Normal"]
FUNDUS_DISEASE_CLASS_INDEX = {label: i for i, label in enumerate(FUNDUS_DISEASE_LABELS)}

FUNDUS_SEVERITY_DIR_MAP = {
    "DR":           "Fundus_Detection/DR_Detection/DR_Severity",
    "Glaucoma":     "Fundus_Detection/Glaucoma_Detection/Glaucoma_Severity",
    "ARMD":         "Fundus_Detection/ARMD_Detection/ARMD_Severity",
    "Cataract":     "Fundus_Detection/Cataract_Detection/Cataract_Severity",
    "Hypertension": "Fundus_Detection/Hypertension_Detection/Hypertension_Severity",
}


# ══════════════════════════════════════════════════════════════════════
#  CONSENSUS CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════
# OCT pipeline: base model is ConvNeXt-L + EfficientNetV2-L + Swin V2 — keep strict threshold
_MIN_OCT_SOLO_CONFIDENCE    = 0.60   # 60% — strict gate, OCT models are reliable
# Fundus pipeline: base model is ConvNeXt-L + EfficientNetV2-L + Swin V2 — relax since scores are flatter
_MIN_FUNDUS_SOLO_CONFIDENCE = 0.45   # 45% — ConvNeXt-L/EfficientNetV2-L/Swin V2 produces lower peak distributions
# Minimum averaged confidence when both models agree on the same top disease (shared)
_MIN_CONSENSUS_CONFIDENCE   = 0.50   # 50% averaged score when both agree
# Minimum severity confidence for the winning disease — if below this, cross-check fires
_MIN_SEVERITY_CONFIDENCE    = 0.45   # 45% — severity model must be reasonably sure
# Label returned when the system cannot reach confident agreement
_UNCERTAIN_LABEL = "Uncertain"


def _run_consensus_classification(image_path):
    """
    Runs the Base Classifier and (if available) the Fused Consensus Architecture Hybrid.

    Agreement logic:
      - Both models available AND agree on top disease → proceed if avg score ≥ _MIN_CONSENSUS_CONFIDENCE
      - Both models available BUT disagree             → return _UNCERTAIN_LABEL (block severity step)
      - Only one model available                       → proceed if its top score ≥ _MIN_SOLO_CONFIDENCE
      - Single model below threshold                   → return _UNCERTAIN_LABEL

    Returns (scores_dict, is_uncertain).
      scores_dict   : {class_name: averaged_score}
      is_uncertain  : True when the system cannot make a confident call
    """
    # ── Local Base Classifier ──
    base_result = main_disease_prediction(BASE_CLASSIFIER_MODEL, image_path)
    base_scores = {label: float(score) for label, score in base_result}
    base_top    = max(base_scores, key=base_scores.get)
    base_conf   = base_scores[base_top]
    logger.info(f"Base classifier    │ {base_top} ({base_conf:.2f})")

    # ── Fused Consensus Architecture Hybrid (if available) ──
    _, core_serve = _get_cached_model(CONSENSUS_OCT_MODEL)

    if core_serve is not None:
        try:
            buf = io.BytesIO()
            PIL.Image.open(image_path).convert('RGB').save(buf, format='JPEG')
            img_bytes = buf.getvalue()

            core_result = core_serve(
                image_bytes=tf.constant([img_bytes]),
                key=tf.constant(['0'])
            )
            core_labels = [l.decode('utf-8') if isinstance(l, bytes) else str(l)
                          for l in core_result['labels'][0].numpy()]
            core_scores_raw = core_result['scores'][0].numpy()
            core_scores = {label: float(core_scores_raw[i]) for i, label in enumerate(core_labels)}
            core_top  = max(core_scores, key=core_scores.get)
            core_conf = core_scores[core_top]
            logger.info(f"Fused Consensus Architecture clf │ {core_top} ({core_conf:.2f})")

            # Average scores
            consensus = {label: (base_scores.get(label, 0.0) + core_scores.get(label, 0.0)) / 2.0
                         for label in DISEASE_LABELS}
            avg_top  = max(consensus, key=consensus.get)
            avg_conf = consensus[avg_top]

            if base_top != core_top:
                # Models disagree — too risky to proceed
                logger.warning(
                    f"Consensus         │ DISAGREEMENT: Base={base_top} Core={core_top} "
                    f"— flagging as Uncertain"
                )
                return consensus, True   # is_uncertain=True

            if avg_conf < _MIN_CONSENSUS_CONFIDENCE:
                logger.warning(
                    f"Consensus         │ Low confidence: {avg_top} ({avg_conf:.2f}) "
                    f"< {_MIN_CONSENSUS_CONFIDENCE} — flagging as Uncertain"
                )
                return consensus, True

            logger.info(f"Consensus         │ AGREE: {avg_top} ({avg_conf:.2f})")
            return consensus, False

        except Exception as e:
            logger.warning(f"Fused Consensus Architecture     │ failed: {e} — falling back to base only")

    else:
        logger.info("Fused Consensus Architecture     │ not available — single model mode")

    # ── Single model fallback — OCT uses strict threshold ──
    if base_conf < _MIN_OCT_SOLO_CONFIDENCE:
        logger.warning(
            f"Base only         │ Low confidence: {base_top} ({base_conf:.2f}) "
            f"< {_MIN_OCT_SOLO_CONFIDENCE} — flagging as Uncertain"
        )
        return base_scores, True

    return base_scores, False


# ══════════════════════════════════════════════════════════════════════
#  MODALITY CLASSIFICATION
# ══════════════════════════════════════════════════════════════════════
def _run_modality_classification(image_path):
    """
    Runs the Modality Model Edge classifier to determine if the image
    is an OCT scan, Fundus photograph, or Invalid.

    Returns: "OCT", "Fundus", or "Invalid"
    """
    _, serve = _get_cached_model(MODALITY_MODEL)

    if serve is None:
        logger.warning("Modality model    │ Not found — defaulting to OCT")
        return "OCT"

    try:
        buf = io.BytesIO()
        PIL.Image.open(image_path).convert('RGB').save(buf, format='JPEG')
        img_bytes = buf.getvalue()

        result = serve(
            image_bytes=tf.constant([img_bytes]),
            key=tf.constant(['0'])
        )
        labels = [l.decode('utf-8') if isinstance(l, bytes) else str(l)
                  for l in result['labels'][0].numpy()]
        scores = result['scores'][0].numpy()

        best_idx = int(np.argmax(scores))
        raw_label = labels[best_idx] if best_idx < len(labels) else ""
        confidence = float(scores[best_idx]) * 100

        # Normalize label — model may return "fundus", "Fundus_Photo", "oct_scan", etc.
        raw_lower = raw_label.lower()
        if "fundus" in raw_lower:
            modality = "Fundus"
        elif "oct" in raw_lower:
            modality = "OCT"
        else:
            modality = "Invalid"

        logger.info(f"Modality          │ {modality} (raw='{raw_label}' {confidence:.1f}%)")
        return modality

    except Exception as e:
        logger.warning(f"Modality model    │ Failed: {e} — defaulting to OCT")
        return "OCT"


# ══════════════════════════════════════════════════════════════════════
#  FUNDUS CLASSIFICATION PIPELINE
# ══════════════════════════════════════════════════════════════════════
def _load_labels(model_dir):
    """Load labels.txt from a model directory. Returns ordered list of label strings."""
    labels_path = os.path.join(model_dir, "labels.txt")
    with open(labels_path) as f:
        return [line.strip() for line in f if line.strip()]


def _run_secondary_vision_model(serve_fn, labels, image_path):
    """Run inference on a ConvNeXt-L + EfficientNetV2-L + Swin V2 hybrid TF SavedModel export.

    These models expect: inputs=float32 tensor (1, 300, 300, 3), values 0-255 (unnormalized).

    Export behaviour varies by version:
      - Some exports return raw logits (sum >> 1.0)  → must apply softmax
      - Some exports return probabilities directly    → softmax must NOT be applied
        (re-applying softmax to probabilities squashes strong predictions flat)

    We detect this by checking if the raw output already sums to ~1.0.
    """
    img = PIL.Image.open(image_path).convert('RGB').resize((300, 300))
    """
    ConvNeXt-L + EfficientNetV2-L + Swin V2 models expect unnormalized 0-255 inputs.
    """
    arr = np.array(img, dtype=np.float32)
    tensor = tf.constant(arr[np.newaxis, ...])  # shape (1, 300, 300, 3)
    result = serve_fn(inputs=tensor)
    raw = result['outputs'][0].numpy()

    # If outputs already sum to ~1.0 they are probabilities — skip softmax
    if abs(raw.sum() - 1.0) < 0.05:
        scores = raw
    else:
        scores = tf.nn.softmax(raw).numpy()

    return {label: float(scores[i]) for i, label in enumerate(labels)}


def _run_fusion_hybrid_model(serve_fn, image_path):
    """Run inference on a Fused Consensus Architecture (CoAtNet + DINOv2 + ResNeSt).

    Fused Consensus Architecture models expect: image_bytes (raw JPEG bytes) + key (string)
    Fused Consensus Architecture models return: labels (string array), scores (float array)
    """
    buf = io.BytesIO()
    PIL.Image.open(image_path).convert('RGB').save(buf, format='JPEG')
    img_bytes = buf.getvalue()

    result = serve_fn(
        image_bytes=tf.constant([img_bytes]),
        key=tf.constant(['0'])
    )
    labels = [
        l.decode('utf-8') if isinstance(l, bytes) else str(l)
        for l in result['labels'][0].numpy()
    ]
    scores_raw = result['scores'][0].numpy()
    return {label: float(scores_raw[i]) for i, label in enumerate(labels)}


def _run_primary_expert_model(serve_fn, image_path):
    """Run inference on a Fusion Edge model (discriminators and pairwise classifiers).

    All Fusion Edge models share the same SavedModel signature:
      inputs:  image_bytes (raw JPEG bytes), key (string)
      outputs: labels (string array), scores (float array), key

    Discriminators and severity models use ConvNeXt-L + EfficientNetV2-L + Swin V2.
    Consensus classifiers use CoAtNet + DINOv2 + ResNeSt.
    Labels are read directly from the model output, so no labels.txt is required.
    """
    buf = io.BytesIO()
    PIL.Image.open(image_path).convert('RGB').save(buf, format='JPEG')
    img_bytes = buf.getvalue()

    result = serve_fn(
        image_bytes=tf.constant([img_bytes]),
        key=tf.constant(['0'])
    )
    labels = [
        l.decode('utf-8') if isinstance(l, bytes) else str(l)
        for l in result['labels'][0].numpy()
    ]
    scores_raw = result['scores'][0].numpy()
    return {label: float(scores_raw[i]) for i, label in enumerate(labels)}


def _run_fundus_consensus_classification(image_path):
    """
    Runs the initial Fundus detection ensemble:
      - Base_Fundus_Classifier (tensor input)
      - Consensus_Fundus_Classifier (image_bytes input)

    When both models are installed, their scores are merged using a dominant-model
    override strategy. If only one is available, the pipeline falls back to that
    model instead of disabling fundus classification.

    Agreement logic:
      - Both agree AND avg conf >= threshold                  -> proceed with consensus
      - Both disagree BUT one is clearly dominant (>=2x conf) -> trust the dominant model
      - Genuine disagreement (neither dominant)               -> Uncertain
      - Single model below pipeline-specific threshold        -> Uncertain

    Dominant model thresholds:
      _DOM_THRESHOLD = 0.55  (minimum absolute confidence to claim dominance)
      _DOM_RATIO     = 2.0   (must be at least 2x more confident than the other model)

    Returns (scores_dict, is_uncertain).
      scores_dict  : {class_name: score}
      is_uncertain : True blocks severity step
    """
    _DOM_THRESHOLD = 0.55   # minimum absolute confidence to be "dominant"
    _DOM_RATIO     = 2.0    # must be this many times more confident than the loser

    base_scores = None
    base_top = None
    base_conf = 0.0
    expert_scores = None
    expert_top = None
    expert_conf = 0.0

    # ── Local Fundus Base Classifier (ConvNeXt-L + EfficientNetV2-L + Swin V2) ──
    _, base_serve = _get_cached_model(FUNDUS_BASE_MODEL)
    if base_serve is not None:
        try:
            base_labels = _load_labels(FUNDUS_BASE_MODEL)
            base_scores = _run_secondary_vision_model(base_serve, base_labels, image_path)
            base_scores = {label: base_scores.get(label, 0.0) for label in FUNDUS_DISEASE_LABELS}
            base_top  = max(base_scores, key=base_scores.get)
            base_conf = base_scores[base_top]
            logger.info(f"Fundus base clf   | {base_top} ({base_conf:.2f})")
        except Exception as e:
            logger.error(f"Fundus base clf   | Failed: {e}")
            base_scores = None
    else:
        logger.warning("Fundus base clf   | not available")

    # ── Initial Fundus Consensus Classifier (CoAtNet + DINOv2 + ResNeSt) ──
    _, expert_serve = _get_cached_model(CONSENSUS_FUNDUS_MODEL)

    if expert_serve is not None:
        try:
            # Consensus_Fundus_Classifier requires raw image_bytes, not a float image tensor.
            expert_scores = _run_fusion_hybrid_model(expert_serve, image_path)
            expert_scores = {label: expert_scores.get(label, 0.0) for label in FUNDUS_DISEASE_LABELS}
            expert_top  = max(expert_scores, key=expert_scores.get)
            expert_conf = expert_scores[expert_top]
            logger.info(f"Fundus consensus clf │ {expert_top} ({expert_conf:.2f})")
        except Exception as e:
            logger.warning(f"Fundus consensus clf │ failed: {e}")
            expert_scores = None
    else:
        logger.info("Fundus consensus clf │ not available")

    if base_scores is None and expert_scores is None:
        logger.error("Fundus detection │ unavailable — no initial fundus classifier could be loaded")
        return None, True

    if base_scores is not None and expert_scores is not None:
        try:

            consensus = {label: (base_scores.get(label, 0.0) + expert_scores.get(label, 0.0)) / 2.0
                         for label in FUNDUS_DISEASE_LABELS}
            avg_top  = max(consensus, key=consensus.get)
            avg_conf = consensus[avg_top]

            if base_top != expert_top:
                # Dominant-model override: trust whichever model is clearly more confident
                # (>= _DOM_THRESHOLD absolute AND >= _DOM_RATIO times the other's top score).
                if expert_conf >= _DOM_THRESHOLD and expert_conf >= base_conf * _DOM_RATIO:
                    logger.warning(
                        f"Fundus consensus  │ DISAGREEMENT — Hybrid dominant "
                        f"({expert_top} {expert_conf:.2f} vs base {base_top} {base_conf:.2f}) "
                        f"— trusting Fused Consensus Architecture"
                    )
                    return expert_scores, expert_conf < _MIN_CONSENSUS_CONFIDENCE

                elif base_conf >= _DOM_THRESHOLD and base_conf >= expert_conf * _DOM_RATIO:
                    logger.warning(
                        f"Fundus consensus  | DISAGREEMENT — Primary dominant "
                        f"({base_top} {base_conf:.2f} vs Expert {expert_top} {expert_conf:.2f}) "
                        f"— trusting Primary base"
                    )
                    return base_scores, base_conf < _MIN_CONSENSUS_CONFIDENCE

                else:
                    # Genuine disagreement — neither model is clearly dominant
                    logger.warning(
                        f"Fundus consensus  | DISAGREEMENT — neither dominant: "
                        f"Base={base_top} ({base_conf:.2f}) vs Expert={expert_top} ({expert_conf:.2f}) "
                        f"— flagging as Uncertain"
                    )
                    return consensus, True

            if avg_conf < _MIN_CONSENSUS_CONFIDENCE:
                logger.warning(
                    f"Fundus consensus  | Low confidence: {avg_top} ({avg_conf:.2f}) "
                    f"< {_MIN_CONSENSUS_CONFIDENCE} — flagging as Uncertain"
                )
                return consensus, True

            logger.info(f"Fundus consensus  | AGREE: {avg_top} ({avg_conf:.2f})")
            return consensus, False

        except Exception as e:
            logger.warning(f"Fundus consensus  │ merge failed: {e} — falling back to base only")

    # ── Single model fallback — Fundus uses relaxed threshold ──
    solo_name = "base" if base_scores is not None else "consensus"
    solo_scores = base_scores if base_scores is not None else expert_scores
    solo_top = base_top if base_scores is not None else expert_top
    solo_conf = base_conf if base_scores is not None else expert_conf

    if solo_conf < _MIN_FUNDUS_SOLO_CONFIDENCE:
        logger.warning(
            f"Fundus {solo_name} only │ Low confidence: {solo_top} ({solo_conf:.2f}) "
            f"< {_MIN_FUNDUS_SOLO_CONFIDENCE} — flagging as Uncertain"
        )
        return solo_scores, True

    logger.info(f"Fundus {solo_name} only │ {solo_top} ({solo_conf:.2f})")
    return solo_scores, False


def _run_fundus_severity(image_path, disease_name):
    """Run fundus severity model for the detected disease."""
    severity_dir = FUNDUS_SEVERITY_DIR_MAP.get(disease_name)
    if severity_dir is None:
        logger.info(f"Severity skipped  │ {disease_name:>4s} │ No severity model configured")
        return "N/A", 0.0

    _, serve = _get_cached_model(severity_dir)
    if serve is None:
        logger.info(f"Severity skipped  │ {disease_name:>4s} │ Model not found")
        return "N/A", 0.0

    try:
        labels = _load_labels(severity_dir)
        scores_dict = _run_secondary_vision_model(serve, labels, image_path)

        prediction = max(scores_dict, key=scores_dict.get)
        confidence = scores_dict[prediction] * 100

        logger.info(f"Severity result   │ {disease_name:>4s} │ {prediction} ({confidence:.1f}%)")
        return prediction, confidence

    except Exception as e:
        logger.error(f"Severity failed   │ {disease_name:>4s} │ {e}")
        return "N/A", 0.0


def _run_fundus_explainability(image_path, disease_name):
    """Run saliency map using the Fundus Base Classifier with fundus-specific ROI mask."""
    _, serve = _get_cached_model(FUNDUS_BASE_MODEL)

    if serve is None:
        logger.warning(f"Explainability    │ {disease_name:>4s} │ Fundus classifier model not found")
        return "", 0.0

    try:
        input_shape = serve.inputs[0].shape[1:3]

        # ConvNeXt-L + EfficientNetV2-L + Swin V2 exports use 'outputs' as the output key; discover it robustly.
        if serve.structured_outputs:
            output_key = list(serve.structured_outputs.keys())[0]
        else:
            test_img = PIL.Image.open(image_path).convert('RGB').resize(
                tuple(int(d) for d in input_shape))
            test_arr = np.array(test_img, dtype=np.float32)[np.newaxis] / 255.0
            test_out = serve(inputs=tf.constant(test_arr))
            output_key = list(test_out.keys())[0]

        true_label_idx = FUNDUS_DISEASE_CLASS_INDEX.get(disease_name, 0)

        heatmap_path, impact_pct = explainer.generate_fundus_explainability(
            serve, output_key, image_path, true_label_idx=true_label_idx,
            infer_size=tuple(int(d) for d in input_shape)
        )
        logger.info(f"Explainability    │ {disease_name:>4s} │ Fundus Burden: {impact_pct:.1f}%")
        return heatmap_path, impact_pct

    except Exception as e:
        logger.error(f"Explainability    │ {disease_name:>4s} │ {e}", exc_info=True)
        return "", 0.0


def _cross_severity_validate_oct(image_path, disease_name, top_severity_conf, runner_up_disease):
    """
    After consensus picks disease_name, run runner_up's severity model too.
    If runner_up severity model is MORE confident than disease_name's severity model,
    the consensus was likely wrong — return is_suspect=True.

    Only fires when top_severity_conf < _MIN_SEVERITY_CONFIDENCE.
    """
    if runner_up_disease in ["NORMAL", "CSR", None]:
        return False   # no severity model to compare against

    runner_up_dir = os.path.join("OCT_Detection", f"{runner_up_disease}_Detection", f"{runner_up_disease}_Severity")
    _, runner_serve = _get_cached_model(runner_up_dir)
    if runner_serve is None:
        return False

    try:
        runner_labels = _load_labels(runner_up_dir)
        runner_scores = _run_secondary_vision_model(runner_serve, runner_labels, image_path)
        runner_conf   = max(runner_scores.values()) * 100
        logger.warning(
            f"Cross-severity    │ {disease_name} sev={top_severity_conf:.1f}%  "
            f"vs {runner_up_disease} sev={runner_conf:.1f}%"
        )
        if runner_conf > top_severity_conf:
            logger.warning(
                f"Cross-severity    │ SUSPECT — {runner_up_disease} severity model "
                f"outscores {disease_name} severity model on this image"
            )
            return True
    except Exception as e:
        logger.warning(f"Cross-severity    │ runner-up check failed: {e}")
    return False


def _cross_severity_validate_fundus(image_path, disease_name, top_severity_conf, runner_up_disease):
    """Same cross-severity validation for fundus pipeline."""
    if runner_up_disease in ["Normal", None]:
        return False

    runner_up_dir = FUNDUS_SEVERITY_DIR_MAP.get(runner_up_disease)
    if runner_up_dir is None:
        return False
    _, runner_serve = _get_cached_model(runner_up_dir)
    if runner_serve is None:
        return False

    try:
        runner_labels = _load_labels(runner_up_dir)
        runner_scores = _run_secondary_vision_model(runner_serve, runner_labels, image_path)
        runner_conf   = max(runner_scores.values()) * 100
        logger.warning(
            f"Cross-severity    │ {disease_name} sev={top_severity_conf:.1f}%  "
            f"vs {runner_up_disease} sev={runner_conf:.1f}%"
        )
        if runner_conf > top_severity_conf:
            logger.warning(
                f"Cross-severity    │ SUSPECT — {runner_up_disease} severity model "
                f"outscores {disease_name} severity model on this image"
            )
            return True
    except Exception as e:
        logger.warning(f"Cross-severity    │ runner-up check failed: {e}")
    return False


def _run_fundus_severity_and_explainability(image_path, disease_name, age, gender):
    """Full Phase 3 for fundus: severity + explainability + clinical report."""
    t0 = time.perf_counter()
    logger.info(f"{'─' * 55}")
    logger.info(f"Fundus pipeline   │ {disease_name:>4s} │ Severity + Explainability")

    severity, sev_conf = _run_fundus_severity(image_path, disease_name)
    heatmap_path, impact_pct = _run_fundus_explainability(image_path, disease_name)

    clinical_report = clinical_llm.generate_clinical_report(
        disease_name, severity, sev_conf, impact_pct, age, gender, modality="Fundus"
    )
    logger.info(f"Clinical report   │ {disease_name:>4s} │ Generated")

    dt = time.perf_counter() - t0
    logger.info(f"Fundus complete   │ {disease_name:>4s} │ Total: {dt:.1f}s")
    logger.info(f"{'─' * 55}")

    return severity, sev_conf, heatmap_path, impact_pct, clinical_report


# ══════════════════════════════════════════════════════════════════════
#  OCT INFERENCE HELPERS
# ══════════════════════════════════════════════════════════════════════
def _run_severity(image_path, disease_name):
    """Run ConvNeXt-L + EfficientNetV2-L + Swin V2 severity model. Uses cache."""
    if disease_name == "CSR":
        logger.info(f"Severity skipped  │ CSR  │ No validated OCT severity scale")
        return "N/A", 0.0

    severity_dir = os.path.join("OCT_Detection", f"{disease_name}_Detection", f"{disease_name}_Severity")
    _, serve = _get_cached_model(severity_dir)

    if serve is None:
        logger.info(f"Severity skipped  │ {disease_name:>4s} │ Model not found")
        return "N/A", 0.0

    try:
        labels = _load_labels(severity_dir)
        scores_dict = _run_secondary_vision_model(serve, labels, image_path)

        prediction = max(scores_dict, key=scores_dict.get)
        confidence = scores_dict[prediction] * 100

        # DR → Macular Thickening terminology
        if disease_name == "DR":
            prediction = _DR_MACULAR_MAP.get(prediction, prediction + " (Macular OCT)")

        logger.info(f"Severity result   │ {disease_name:>4s} │ {prediction} ({confidence:.1f}%)")
        return prediction, confidence

    except Exception as e:
        logger.error(f"Severity failed   │ {disease_name:>4s} │ {e}")
        return "N/A", 0.0


def _run_explainability(image_path, disease_name):
    """Run saliency map + impact metric using the base disease classifier.

    Passes the TF serving function and output key directly to the explainer
    so that tf.GradientTape can compute gradients through the model graph
    (required by SmoothGrad). Uses the disease's class index in the
    multi-class base classifier output.
    """
    base_model_dir = "OCT_Detection/Base_OCT_Classifier"
    _, serve = _get_cached_model(base_model_dir)

    if serve is None:
        logger.warning(f"Explainability    │ {disease_name:>4s} │ Base classifier model not found")
        return "", 0.0

    try:
        input_shape = serve.inputs[0].shape[1:3]

        # Discover output key: some SavedModels expose structured_outputs,
        # others (e.g. older Keras exports) only surface keys at call time.
        if serve.structured_outputs:
            output_key = list(serve.structured_outputs.keys())[0]
        else:
            test_img = PIL.Image.open(image_path).convert('RGB').resize(
                tuple(int(d) for d in input_shape))
            test_arr = np.array(test_img, dtype=np.float32)[np.newaxis]
            test_out = serve(tf.constant(test_arr))
            output_key = list(test_out.keys())[0]

        true_label_idx = DISEASE_CLASS_INDEX[disease_name]

        heatmap_path, impact_pct = explainer.generate_explainability(
            serve, output_key, image_path, true_label_idx=true_label_idx,
            infer_size=tuple(int(d) for d in input_shape)
        )
        logger.info(f"Explainability    │ {disease_name:>4s} │ Burden: {impact_pct:.1f}%")
        return heatmap_path, impact_pct

    except Exception as e:
        logger.error(f"Explainability    │ {disease_name:>4s} │ {e}", exc_info=True)
        return "", 0.0


# ══════════════════════════════════════════════════════════════════════
#  SEVERITY + EXPLAINABILITY + REPORT (called after disease confirmed)
# ══════════════════════════════════════════════════════════════════════
def run_severity_and_explainability(image_path, disease_name, age, gender):
    """
    Runs severity grading, explainability, and clinical report generation
    for a confirmed disease diagnosis.

    Severity uses ConvNeXt-L + EfficientNetV2-L + Swin V2 hybrid models.
    Saliency uses the base disease classifier (tensor format) so the
    heatmap answers 'where is the disease' via multi-class gradients.
    """
    t0 = time.perf_counter()
    logger.info(f"{'─' * 55}")
    logger.info(f"Pipeline started  │ {disease_name:>4s} │ Severity + Explainability")

    # Phase A: Severity
    severity, sev_conf = _run_severity(image_path, disease_name)

    # Phase B: Explainability
    heatmap_path, impact_pct = _run_explainability(image_path, disease_name)

    # Phase C: Clinical LLM Report
    clinical_report = clinical_llm.generate_clinical_report(
        disease_name, severity, sev_conf, impact_pct, age, gender
    )
    logger.info(f"Clinical report   │ {disease_name:>4s} │ Generated")

    dt = time.perf_counter() - t0
    logger.info(f"Pipeline complete │ {disease_name:>4s} │ Total: {dt:.1f}s")
    logger.info(f"{'─' * 55}")

    return severity, sev_conf, heatmap_path, impact_pct, clinical_report


# ══════════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINT — check_image()
# ══════════════════════════════════════════════════════════════════════
def check_image(image_path, age, gender):
    """
    Full diagnostic pipeline for a single retinal image (OCT or Fundus).

    Flow:
      Step 0: Modality detection (OCT / Fundus / Invalid)
      OCT path:
        1. Disease Classifier → primary disease classification
        2. DME/DR disambiguator → only if classifier detected DME or DR
        3. Severity + Explainability + Clinical report
      Fundus path:
        F1. Fundus Initial Consensus Classifier (5-class + Normal)
        F2. Fundus Severity Model (per disease)
        F3. Explainability (SmoothGrad with fundus ROI mask)
        F4. Clinical LLM Report
    """
    t_start = time.perf_counter()
    logger.info(f"{'═' * 55}")
    logger.info(f"New scan          │ {os.path.basename(image_path)}")
    logger.info(f"Patient           │ {age}y {gender}")

    # Initialize defaults
    severity = "N/A"
    sev_conf = 0.0
    heatmap_path = ""
    impact_pct = 0.0
    clinical_report = "Scan exhibits no abnormal characteristics requiring pathological evaluation."
    discriminator_info = {}

    # ── Step 0: Modality Detection ──
    modality = _run_modality_classification(image_path)

    if modality == "Invalid":
        logger.warning("Result            │ Invalid image — cannot classify")
        return "Invalid", 0, {}, severity, sev_conf, heatmap_path, impact_pct, clinical_report, "Invalid", discriminator_info

    # ══════════════════════════════════════════════════════════════
    #  FUNDUS PIPELINE
    # ══════════════════════════════════════════════════════════════
    if modality == "Fundus":
        logger.info(f"Pipeline          │ FUNDUS")

        # ── F1: Initial Fundus Consensus Classification ──
        logger.info(f"Step F1           │ Initial Fundus Consensus Classification")
        disease_scores, is_uncertain = _run_fundus_consensus_classification(image_path)

        if disease_scores is None:
            logger.error("Fundus detection  │ Unavailable — no initial fundus classifier installed")
            clinical_report = (
                "Fundus disease classification is currently unavailable: no initial fundus "
                "classifier model has been initialized. Please ensure the model directories "
                "are correctly installed."
            )
            return "Unavailable", 0.0, {}, "N/A", 0.0, "", 0.0, clinical_report, "Fundus", discriminator_info

        sorted_scores = sorted(disease_scores.items(), key=lambda x: x[1], reverse=True)
        top3 = " | ".join(f"{k}: {v:.2f}" for k, v in sorted_scores[:3])
        logger.info(f"Fundus top-3      │ {top3}")

        top_disease, top_score = sorted_scores[0]

        # ── Normal ──
        if top_disease == "Normal":
            logger.info(f"Result            │ NORMAL ({top_score:.2f})")
            return _fmt_disease("NORMAL"), top_score * 100, _fmt_scores(disease_scores), severity, sev_conf, heatmap_path, impact_pct, clinical_report, "Fundus", discriminator_info

        disease_name = top_disease
        highest_prob = top_score * 100

        # ── Step F1b: Combined 5-Model Fundus Discriminator Ensemble ──────
        # When the consensus is uncertain (top < 0.75 or gap < 0.25), run ALL
        # installed discriminator models.  Each model outputs a score for its 3
        # classes.  Scores are accumulated per disease and averaged across every
        # model that covers that disease.  The class with the highest average
        # score wins — a much stronger signal than any single discriminator.
        if len(sorted_scores) >= 2:
            gap = top_score - sorted_scores[1][1]
            if top_score < 0.75 or gap < 0.25:
                logger.info(
                    f"Step F1b          │ Combined 5-model discriminator ensemble "
                    f"(top={top_score:.2f}, gap={gap:.2f})"
                )
                accum        = {}
                models_run   = 0
                for disc_info in _FUNDUS_DISC_MODELS:
                    _, disc_serve = _get_cached_model(disc_info["dir"])
                    if disc_serve is None:
                        logger.info(f"Fundus disc       │ {disc_info['key']} not installed — skipped")
                        continue
                    try:
                        disc_scores = _run_primary_expert_model(disc_serve, image_path)
                        models_run += 1
                        score_str = "  ".join(f"{k}={v:.2f}" for k, v in disc_scores.items())
                        logger.info(f"Fundus disc       │ {disc_info['key']}: {score_str}")
                        for label, score in disc_scores.items():
                            accum.setdefault(label, []).append(score)
                    except Exception as e:
                        logger.warning(f"Fundus disc       │ {disc_info['key']} failed: {e}")

                if models_run > 0 and accum:
                    avg_scores   = {lbl: sum(v) / len(v) for lbl, v in accum.items()}
                    disc_top     = max(avg_scores, key=avg_scores.get)
                    disc_conf    = avg_scores[disc_top]
                    avg_str      = "  ".join(f"{k}={v:.2f}" for k, v in sorted(avg_scores.items(), key=lambda x: -x[1]))
                    logger.info(f"Fundus disc avg   │ [{avg_str}]")
                    logger.info(
                        f"Fundus disc       │ {disease_name} → {disc_top} ({disc_conf:.2f}) "
                        f"[{models_run}/{len(_FUNDUS_DISC_MODELS)} models]"
                    )
                    disease_name = disc_top
                    highest_prob = disc_conf * 100
                    discriminator_info = {
                        "name": f"Fundus Pairwise Ensemble ({models_run} models)",
                        "initial": {d: round(s * 100, 1) for d, s in sorted_scores[:3]},
                        "discriminator": {k: round(v * 100, 1) for k, v in sorted(avg_scores.items(), key=lambda x: -x[1])},
                        "final": disc_top,
                        "final_confidence": round(disc_conf * 100, 1),
                    }
                else:
                    logger.info("Fundus disc       │ no discriminator models installed — keeping consensus result")

        # Discriminator may redirect a borderline case to Normal
        if disease_name == "Normal":
            logger.info("Result            │ NORMAL (discriminator redirect)")
            return _fmt_disease("NORMAL"), highest_prob, _fmt_scores(disease_scores), \
                   severity, sev_conf, heatmap_path, impact_pct, clinical_report, "Fundus", discriminator_info

        # ── Multi-disease severity scoring for all candidate diseases ──
        # Run severity on top-3 non-Normal diseases regardless of is_uncertain.
        # This gives the UI probability + severity for each, so clinician can see
        # the full picture when models are ambiguous.
        candidate_diseases = [d for d, _ in sorted_scores if d not in ("Normal",)][:3]
        severity_map = {}   # {formatted_disease: (severity_label, sev_conf)}
        for candidate in candidate_diseases:
            sev_label, sev_c = _run_fundus_severity(image_path, candidate)
            severity_map[_fmt_disease(candidate)] = (_fmt_severity(sev_label), sev_c)
            logger.info(f"Severity probe    │ {candidate}: {sev_label} ({sev_c:.1f}%)")

        # ── Cross-severity validation on primary candidate ──
        fusion_sev_conf = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))[1]
        runner_up = candidate_diseases[1] if len(candidate_diseases) > 1 else None
        is_suspect = False
        if fusion_sev_conf < _MIN_SEVERITY_CONFIDENCE:
            is_suspect = _cross_severity_validate_fundus(image_path, disease_name, fusion_sev_conf, runner_up)

        # ── Detection-gap dominance override ──
        # If consensus flagged uncertain but the top disease has a clear detection
        # lead (>= 25%) over the runner-up AND the severity model returned a valid
        # grade, trust the top disease and proceed as a single confident result.
        if is_uncertain and len(sorted_scores) >= 2:
            det_gap = sorted_scores[0][1] - sorted_scores[1][1]
            fusion_sev_label = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))[0]
            if det_gap >= 0.25 and fusion_sev_label != "N/A":
                logger.info(
                    f"Detection gap     │ {disease_name} leads by {det_gap:.2f} with valid "
                    f"severity — overriding uncertain flag"
                )
                is_uncertain = False

        if is_uncertain or is_suspect:
            # Return all candidate severities so UI can show the full probability breakdown
            clinical_report = (
                "The diagnostic models detected overlapping disease probabilities. "
                "Multiple conditions have been assessed — please review all probabilities "
                "and severity estimates below and refer to a specialist for confirmation."
            )
            logger.warning(f"MULTI-DISEASE     │ Returning all candidate severities for UI")
            fusion_sev, fusion_sev_conf = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))
            return (_UNCERTAIN_LABEL, highest_prob, _fmt_scores(disease_scores),
                    fusion_sev, fusion_sev_conf, "", 0.0, clinical_report, "Fundus",
                    severity_map, discriminator_info)

        # ── Single confident result ──
        severity, sev_conf = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))
        heatmap_path, impact_pct = _run_fundus_explainability(image_path, disease_name)
        clinical_report = clinical_llm.generate_clinical_report(
            disease_name, severity, sev_conf, impact_pct, age, gender, modality="Fundus"
        )

        dt = time.perf_counter() - t_start
        logger.info(f"{'═' * 55}")
        logger.info(f"FINAL DIAGNOSIS   │ {disease_name} │ {highest_prob:.1f}% │ Fundus │ {dt:.1f}s")
        logger.info(f"{'═' * 55}")

        return _fmt_disease(disease_name), highest_prob, _fmt_scores(disease_scores), severity, sev_conf, heatmap_path, impact_pct, clinical_report, "Fundus", discriminator_info

    # ══════════════════════════════════════════════════════════════
    #  OCT PIPELINE (existing logic, unchanged)
    # ══════════════════════════════════════════════════════════════
    logger.info(f"Pipeline          │ OCT")

    # ── Step 1: Consensus Classification (Base [ConvNeXt-L/EfficientNetV2-L/Swin V2] + Consensus Hybrid [CoAtNet/DINOv2/ResNeSt]) ──
    logger.info(f"Step 1            │ Consensus Classification")
    disease_scores, is_uncertain = _run_consensus_classification(image_path)

    # Log top-3 scores
    sorted_scores = sorted(disease_scores.items(), key=lambda x: x[1], reverse=True)
    top3 = " | ".join(f"{k}: {v:.2f}" for k, v in sorted_scores[:3])
    logger.info(f"Consensus top-3   │ {top3}")

    top_disease, top_score = sorted_scores[0]

    # ── Early exit: Normal ──
    if top_disease == "NORMAL":
        logger.info(f"Result            │ NORMAL ({top_score:.2f})")
        return _fmt_disease("NORMAL"), top_score * 100, _fmt_scores(disease_scores), severity, sev_conf, heatmap_path, impact_pct, clinical_report, "OCT", discriminator_info

    disease_name = top_disease
    highest_prob = top_score * 100

    # ── Step 2a: DME/DR disambiguation ──
    # Only trigger when DME and DR are genuinely ambiguous (top < 0.75 AND gap < 0.25).
    if disease_name in ["DME", "DR"]:
        other = "DME" if disease_name == "DR" else "DR"
        other_score = disease_scores.get(other, 0.0)
        gap = top_score - other_score
        if top_score >= 0.75 or gap >= 0.25:
            logger.info(
                f"Step 2a           │ Skipping DME/DR disc — consensus dominant: "
                f"{disease_name} ({top_score:.2f}) vs {other} ({other_score:.2f}), gap={gap:.2f}"
            )
        else:
            logger.info(f"Step 2a           │ DME/DR Disambiguator (gap={gap:.2f} — ambiguous)")
            _, disc_serve = _get_cached_model(DME_DR_MODEL)
            if disc_serve is not None:
                try:
                    disc_scores  = _run_primary_expert_model(disc_serve, image_path)
                    dme_or_dr    = max(disc_scores, key=disc_scores.get)
                    disc_conf    = disc_scores[dme_or_dr]
                    logger.info(f"DME/DR result     │ {disease_name} → {dme_or_dr} ({disc_conf:.2f})")
                    _init_dme_dr = disease_name
                    disease_name = dme_or_dr
                    highest_prob = disc_conf * 100
                    is_uncertain = False   # discriminator is authoritative for this pair
                    discriminator_info = {
                        "name": "DME/DR Discriminator",
                        "initial": {_init_dme_dr: round(top_score * 100, 1), other: round(other_score * 100, 1)},
                        "discriminator": {k: round(v * 100, 1) for k, v in disc_scores.items()},
                        "final": dme_or_dr,
                        "final_confidence": round(disc_conf * 100, 1),
                    }
                except Exception as e:
                    logger.warning(f"DME/DR disc       │ failed: {e} — keeping consensus result")
            else:
                logger.info("DME/DR disc       │ Model not found — keeping consensus result")

    # ── Step 2b: ARMD/CNV disambiguation ──
    # ARMD and CNV share OCT features (subretinal fluid, drusen overlap) and the
    # general consensus classifier is not reliable enough to distinguish them —
    # so the dedicated discriminator ALWAYS runs whenever either is the top class.
    if disease_name in ["ARMD", "CNV"]:
        other       = "ARMD" if disease_name == "CNV" else "CNV"
        other_score = disease_scores.get(other, 0.0)
        gap         = top_score - other_score
        logger.info(
            f"Step 2b           │ ARMD/CNV Discriminator always runs: "
            f"{disease_name} ({top_score:.2f}) vs {other} ({other_score:.2f}), gap={gap:.2f}"
        )
        _, disc_serve = _get_cached_model(ARMD_CNV_MODEL)
        if disc_serve is not None:
            try:
                disc_scores      = _run_primary_expert_model(disc_serve, image_path)
                armd_or_cnv      = max(disc_scores, key=disc_scores.get)
                disc_conf        = disc_scores[armd_or_cnv]
                logger.info(f"ARMD/CNV result   │ {disease_name} → {armd_or_cnv} ({disc_conf:.2f})")
                _init_armd_cnv   = disease_name
                disease_name     = armd_or_cnv
                highest_prob     = disc_conf * 100
                is_uncertain     = False   # discriminator is authoritative for this pair
                discriminator_info = {
                    "name": "ARMD/CNV Discriminator",
                    "initial": {_init_armd_cnv: round(top_score * 100, 1), other: round(other_score * 100, 1)},
                    "discriminator": {k: round(v * 100, 1) for k, v in disc_scores.items()},
                    "final": armd_or_cnv,
                    "final_confidence": round(disc_conf * 100, 1),
                }
            except Exception as e:
                logger.warning(f"ARMD/CNV disc     │ failed: {e} — keeping consensus result")
        else:
            logger.info("ARMD/CNV disc     │ Model not found — keeping consensus result")

    # ── Multi-disease severity scoring for top-3 candidates ──
    # Run severity on top-3 non-NORMAL diseases always — gives the UI the full
    # probability + severity breakdown so the clinician sees all candidates.
    candidate_diseases = [d for d, _ in sorted_scores if d not in ("NORMAL", "CSR")][:3]
    severity_map = {}   # {formatted_disease: (severity_label, sev_conf)}
    for candidate in candidate_diseases:
        sev_label, sev_c = _run_severity(image_path, candidate)
        severity_map[_fmt_disease(candidate)] = (_fmt_severity(sev_label), sev_c)
        logger.info(f"Severity probe    │ {candidate}: {sev_label} ({sev_c:.1f}%)")

    # ── Cross-severity validation ──
    fusion_sev_conf = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))[1]
    runner_up = candidate_diseases[1] if len(candidate_diseases) > 1 else None
    is_suspect = False
    if fusion_sev_conf < _MIN_SEVERITY_CONFIDENCE:
        is_suspect = _cross_severity_validate_oct(image_path, disease_name, fusion_sev_conf, runner_up)

    # ── Detection-gap dominance override ──
    if is_uncertain and len(sorted_scores) >= 2:
        det_gap = sorted_scores[0][1] - sorted_scores[1][1]
        fusion_sev_label = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))[0]
        if det_gap >= 0.25 and fusion_sev_label != "N/A":
            logger.info(
                f"Detection gap     │ {disease_name} leads by {det_gap:.2f} with valid "
                f"severity — overriding uncertain flag"
            )
            is_uncertain = False

    if is_uncertain or is_suspect:
        clinical_report = (
            "The diagnostic models detected overlapping disease probabilities. "
            "Multiple conditions have been assessed — please review all probabilities "
            "and severity estimates below and refer to a specialist for confirmation."
        )
        logger.warning(f"MULTI-DISEASE     │ Returning all candidate severities for UI")
        fusion_sev, fusion_sev_conf = severity_map.get(_fmt_disease(disease_name), ("N/A", 0.0))
        return (_UNCERTAIN_LABEL, highest_prob, _fmt_scores(disease_scores),
                fusion_sev, fusion_sev_conf, "", 0.0, clinical_report, "OCT",
                severity_map, discriminator_info)

    # ── Single confident result ──
    severity, sev_conf, heatmap_path, impact_pct, clinical_report = \
        run_severity_and_explainability(image_path, disease_name, age, gender)

    dt = time.perf_counter() - t_start
    logger.info(f"{'═' * 55}")
    logger.info(f"FINAL DIAGNOSIS   │ {disease_name} │ {highest_prob:.1f}% │ OCT │ {dt:.1f}s")
    logger.info(f"{'═' * 55}")

    return _fmt_disease(disease_name), highest_prob, _fmt_scores(disease_scores), _fmt_severity(severity), sev_conf, heatmap_path, impact_pct, clinical_report, "OCT", discriminator_info
