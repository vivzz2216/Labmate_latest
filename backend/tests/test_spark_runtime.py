import pytest
from app.services.evidence_planner import experiment_category
from app.security.generated_code import validate_generated_code

def test_spark_is_notebook_and_requires_explicit_capability():
    code='from pyspark.sql import SparkSession\nspark=SparkSession.builder.getOrCreate()'
    assert experiment_category('python', '', code)=='notebook'
    validate_generated_code(code, 'python', capability='spark')
    with pytest.raises(ValueError):validate_generated_code(code,'python')
    with pytest.raises(ValueError):validate_generated_code('import subprocess','python',capability='spark')
    from app.services.colab_requirements import missing_required_libraries
    assert missing_required_libraries('Use PySpark to calculate an average.', 'import pandas as pd\nprint(pd.DataFrame())') == ['pyspark']
    assert missing_required_libraries('Use PySpark, not a pandas replacement.', code) == []

@pytest.mark.asyncio
async def test_spark_refuses_host_execution(monkeypatch):
    from app.services.spark_runtime import capture_spark
    monkeypatch.delenv('LABMATE_SANDBOX_WORKER',raising=False)
    result=await capture_spark('from pyspark.sql import SparkSession')
    assert not result.success and result.exit_code==126
