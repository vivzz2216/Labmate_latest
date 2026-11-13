import pytest
from app.services.colab_requirements import missing_required_libraries
from app.services.colab_worker import validate_cell
from app.services.generation_service import student_personalization_prompt

@pytest.mark.parametrize('question,code,expected', [
    ('Use scikit-learn linear regression.', 'import numpy as np\nprint(np.array([1]))', ['sklearn']),
    ('Use scikit-learn linear regression.', 'from sklearn.linear_model import LinearRegression\nLinearRegression()', []),
    ('Use matplotlib and seaborn to make a chart.', 'import matplotlib.pyplot as plt\nplt.plot([1])', ['seaborn']),
    ('Use pgmpy for a Bayesian network.', 'import pgmpy\nprint(2)', ['pgmpy']),
    ('You may use NLTK.', 'import re\nprint(re.findall("x", "x"))', []),
    # "PyTorch or Keras" offers a choice: either framework satisfies it.
    ('Implement an MLP using PyTorch or Keras.', 'import torch\nprint(torch.zeros(1))', []),
    ('Implement an MLP using PyTorch or Keras.', 'from tensorflow import keras\nprint(keras.layers)', []),
    ('Implement an MLP using PyTorch or Keras.', 'import numpy as np\nprint(np.zeros(1))', ['keras or torch']),
    # Both are required when the sentence joins them with "and".
    ('Use PyTorch and Keras.', 'import torch\nprint(torch.zeros(1))', ['keras']),
    # Keras reached through TensorFlow is still Keras.
    ('Build a CNN using Keras.', 'from tensorflow import keras\nprint(keras.Sequential())', []),
    ('Build a CNN using Keras.', 'from tensorflow.keras import layers\nprint(layers.Dense(1))', []),
    ('Build a CNN using Keras.', 'import tensorflow as tf\nprint(tf.keras.Sequential())', []),
    ('Build a CNN using Keras.', 'import tensorflow as tf\nprint(tf.zeros(1))', ['keras']),
])
def test_explicit_library_must_be_used(question,code,expected):
    assert missing_required_libraries(question,code)==expected

def test_windows_tensorflow_gpu_warning_is_not_shown_in_notebook_output():
    from app.services.colab_worker import clean_notebook_text
    noisy='WARNING:tensorflow:TensorFlow GPU support is not available on native Windows for TensorFlow >= 2.11.\nEpoch 1/5'
    assert clean_notebook_text(noisy,is_stderr=True)=='Epoch 1/5'
    assert 'GPU support' in clean_notebook_text(noisy,is_stderr=False)

def test_torch_style_super_initialization_is_allowed_but_introspection_is_not():
    validate_cell('class Model:\n def __init__(self):\n  super().__init__()')
    with pytest.raises(PermissionError):validate_cell('print(object.__subclasses__())')
    with pytest.raises(PermissionError):validate_cell('print(x.__class__)')

def test_profile_prompt_does_not_force_identity_into_sample_records():
    prompt=student_personalization_prompt('Lab Test Student','','','')
    assert 'Do not force these details into unrelated sample records' in prompt
    assert 'varied, natural example data' in prompt

def test_tensorflow_reports_missing_cpu_feature_instead_of_crashing(monkeypatch):
    from app.services import colab_worker
    monkeypatch.setattr(colab_worker,'_CPU_HAS_AVX',False)
    with pytest.raises(RuntimeError,match='require AVX'):
        colab_worker.validate_cell('import tensorflow as tf')
    colab_worker.validate_cell('import torch')
