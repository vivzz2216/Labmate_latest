import pytest
from app.services.colab_requirements import missing_required_libraries
from app.services.manual_sections import numbered_experiments
from app.services.evidence_planner import experiment_category


@pytest.mark.parametrize('code', [
    'import tensorflow as tf\nmodel = tf.keras.Sequential([])',
    'from tensorflow import keras\nmodel = keras.Sequential([])',
    'from tensorflow.keras import layers\nlayer = layers.Dense(2)',
    'import keras\nmodel = keras.Sequential([])',
])
def test_valid_keras_import_forms(code):
    assert missing_required_libraries('Train a compact Keras classifier.', code) == []


@pytest.mark.parametrize('verb', ['Train', 'Build', 'Implement', 'Fit', 'Use'])
def test_cannot_replace_required_framework(verb):
    assert missing_required_libraries(f'{verb} a Keras classifier.',
        'from sklearn.neural_network import MLPClassifier\nm = MLPClassifier()') == ['keras']


def test_optional_keras_remains_optional():
    assert missing_required_libraries('You may use Keras.', 'print(1)') == []


def test_fit_aim_is_preserved():
    tasks = numbered_experiments('Experiment 1: Gradient descent\nAim: Fit y=2*x+1 using NumPy.')
    assert len(tasks) == 1 and 'Fit y=' in tasks[0]['text']


def test_python_deep_learning_uses_notebook():
    assert experiment_category('python', 'Train a neural network', 'import torch') == 'notebook'


def test_disjunctive_framework_requirements():
    prompt = 'Implement a Multilayer Perceptron with PyTorch or Keras to classify XOR.'
    # PyTorch implementation satisfies 'PyTorch or Keras'
    assert missing_required_libraries(prompt, 'import torch\nimport torch.nn as nn\nx = torch.tensor([1.0])') == []
    # Keras implementation satisfies 'PyTorch or Keras'
    assert missing_required_libraries(prompt, 'import keras\nmodel = keras.Sequential()') == []
    # Neither satisfies 'PyTorch or Keras'
    missing = missing_required_libraries(prompt, 'import numpy as np\nx = np.array([1])')
    assert len(missing) == 1 and ('torch' in missing[0] and 'keras' in missing[0])
