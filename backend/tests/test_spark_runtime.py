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


def test_spark_stdout_strips_log4j_status_console_listener_noise():
    from app.services.spark_runtime import clean_spark_stdout
    noisy = (
        "ERROR StatusConsoleListener Could not determine local host name\n"
        " java.net.UnknownHostException: fvm-123: Temporary failure in name resolution\n"
        "\tat java.base/java.net.InetAddress.getLocalHost(InetAddress.java:1671)\n"
        "Caused by: java.net.UnknownHostException: fvm-123\n"
        "\t... 14 more\n"
        "Spark Version: 3.5.7\n"
        "RDD Sum: 6\n"
    )
    assert clean_spark_stdout(noisy) == "Spark Version: 3.5.7\nRDD Sum: 6\n"


@pytest.mark.asyncio
async def test_python_language_spark_solution_passes_execute_solution_validation(monkeypatch):
    from app.services import assignment_workflow
    from app.services.manual_sections import section_language
    assert section_language("Experiment 1: PySpark DataFrame Aggregation", "Use PySpark SparkSession and RDD.") == "colab"
    async def fake_execute(code, language, filename, question, **kwargs):
        return True, "Spark Version: 3.5.7\nRDD Sum: 6\n", "", 0, []
    monkeypatch.setattr(assignment_workflow.executor_service, "execute_code", fake_execute)
    res = await assignment_workflow.execute_solution(
        "from pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\nspark.stop()\n",
        "python",
        "Use PySpark to create a DataFrame.",
        "g1",
        "Student",
    )
    assert res.success is True

