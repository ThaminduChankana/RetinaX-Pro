import pathlib

import PIL.Image
import numpy as np
import tensorflow


class Model:
    def __init__(self, model_dirpath):
        model = tensorflow.saved_model.load(str(model_dirpath))
        self.serve = model.signatures['serving_default']
        self.input_shape = self.serve.inputs[0].shape[1:3]

    def predict(self, image_filepath):
        image = PIL.Image.open(image_filepath).resize(self.input_shape)

        # Convert image to RGB if it's not already
        if image.mode != 'RGB':
            image = image.convert('RGB')

        input_array = np.array(image, dtype=np.float32)[np.newaxis, :, :, :]

        input_tensor = tensorflow.convert_to_tensor(input_array)
        return self.serve(input_tensor)


def main_disease_prediction(model_dirpath, image_filepath):
    # Convert string paths to pathlib.Path objects
    model_dirpath = pathlib.Path(model_dirpath)
    image_filepath = pathlib.Path(image_filepath)

    # Check if the provided model path is a file and adjust accordingly
    if model_dirpath.is_file():
        model_dirpath = model_dirpath.parent

    # Load the model
    model = Model(model_dirpath)

    # Predict using the model
    outputs = model.predict(image_filepath)

    # Define the labels
    labels = ["ARMD", "CNV", "CSR", "DME", "DR", "MH", "NORMAL"]

    # Extract scores from outputs
    scores = list(outputs.values())[0][0]

    # Create a 2D array for labels and scores
    results = []

    # Format each label with its corresponding score and add to the results array
    for index, score in enumerate(scores):
        label = labels[index]
        formatted_score = f"{score:.2f}"
        results.append([label, formatted_score])

    return results
