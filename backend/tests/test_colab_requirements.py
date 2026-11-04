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
])
def test_explicit_library_must_be_used(question,code,expected):
    assert missing_required_libraries(question,code)==expected

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
