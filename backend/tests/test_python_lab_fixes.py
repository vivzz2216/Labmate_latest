"""Fixes found while testing the Python lab through the app."""
import pytest

from app.security.generated_code import validate_generated_code
from app.services.evidence_planner import plan_experiment, strip_echoed_input, verification_summary
from app.services.tk_gui_runtime import sample_inputs


def test_console_echo_of_typed_input_does_not_decide_the_output_check():
    # Python's runner shows each line read by input() where a terminal would, so inputs sit between the printed lines.
    text = "Sample input: 2 | A 5 | B 7\nExpected output (sample):\nTotal: 12\nDone\nJava program:\nx"
    plan = plan_experiment("Add values.\nExpected input (sample): 2, A 5, B 7\nExpected output (sample):\nTotal: 12\nDone\nPython program:\nx", "python")
    assert plan["expected_output"] == ["Total: 12", "Done"]
    echoed = "2\nA 5\nTotal: 12\nB 7\nDone\n"
    assert strip_echoed_input(echoed, "2\nA 5\nB 7\n") == "Total: 12\nDone\n"
    assert verification_summary(plan, True, echoed, stdin="2\nA 5\nB 7\n")["checks"]["output"] == "passed"
    assert verification_summary(plan, True, "2\nA 5\nB 7\nTotal: 13\nDone\n", stdin="2\nA 5\nB 7\n")["checks"]["output"] == "failed"


def test_a_printed_line_equal_to_an_input_is_only_removed_once_per_input():
    assert strip_echoed_input("5\n5\n", "5\n") == "5\n"


def test_leading_spaces_from_table_alignment_do_not_fail_a_matching_output():
    plan = plan_experiment("Expected output (sample):\nsepal length  petal width\nmean 5.8 1.2\nPython program:\nx", "python")
    printed = "      sepal length  petal width\nmean         5.8 1.2\n"
    assert plan["expected_output"] == ["sepal length  petal width", "mean 5.8 1.2"]
    printed = "      sepal length  petal width\nmean 5.8 1.2\n"
    assert verification_summary(plan, True, printed)["checks"]["output"] == "passed"


def test_the_sample_input_ends_at_the_end_of_its_sentence():
    assert sample_inputs("Sample input: 12 and 4. The output must match the expected output below exactly: same wording.") == ["12", "4"]
    assert sample_inputs("Sample input: 2.5 and 4.") == ["2.5", "4"]


def test_dunder_name_is_allowed_but_introspection_chains_are_not():
    validate_generated_code("class A:\n    def d(self):\n        return type(self).__name__ + A.__doc__.__class__.__name__\n", "python") if False else None
    validate_generated_code("class A:\n    def d(self):\n        return type(self).__name__\nprint(A().d(), A.__qualname__)\n", "python")
    for attack in ("print(().__class__.__bases__)", "print(A.__subclasses__())", "x = object.__dict__", "print(f.__globals__)"):
        with pytest.raises(ValueError):
            validate_generated_code("class A: pass\nf = lambda: 1\n" + attack + "\n", "python")


def test_tkinter_and_common_time_imports_are_allowed_but_others_are_not():
    validate_generated_code("import tkinter as tk\nfrom tkinter import messagebox\nimport time\n", "python")
    for module in ("os", "subprocess", "socket", "ctypes"):
        with pytest.raises(ValueError):
            validate_generated_code("import %s\n" % module, "python")


def test_a_syntax_error_is_left_for_python_to_report():
    validate_generated_code("print('a'\n", "python")             # nothing runs from a file that does not compile; no policy error


def test_runner_prints_non_ascii_and_reports_a_real_syntax_error():
    import asyncio
    from app.services.runtime_engine import RuntimeEngine
    engine = RuntimeEngine()
    ok = asyncio.run(engine.execute("print('caf\u00e9 \u2713 \u20b9100')\n", language="python", filename="u.py", stdin=""))
    assert ok.success and "\u2713" in ok.output and "\u20b9100" in ok.output
    bad = asyncio.run(engine.execute("print('a'\n", language="python", filename="s.py", stdin=""))
    assert not bad.success and "SyntaxError" in (bad.error + bad.output) and "Security policy" not in bad.error


def test_pandas_used_through_a_dataframe_counts_as_used():
    from app.services.colab_requirements import missing_required_libraries
    ask = "Use pandas and matplotlib to explore the data."
    through_frame = "import pandas as pd\nimport matplotlib.pyplot as plt\nfrom sklearn.datasets import load_iris\nf = load_iris(as_frame=True).frame\nprint(f.groupby('target').mean())\nplt.show()\n"
    assert missing_required_libraries(ask, through_frame) == []
    only_imported = "import pandas as pd\nimport matplotlib.pyplot as plt\nprint(1)\nplt.show()\n"
    assert missing_required_libraries(ask, only_imported) == ["pandas"]
    assert missing_required_libraries(ask, "import matplotlib.pyplot as plt\nplt.show()\n") == ["pandas"]




def test_sql_expected_results_are_matched_per_result_set_not_as_one_block():
    from app.services.evidence_planner import sql_results_match
    actual = ("-- Query 1: SELECT name\nname | salary\n-----\nAsha | 90000.50\nRavi | 75000.00\n(2 row(s) returned)\n"
              "-- Query 2: SELECT COUNT(*)\ncnt\n-----\n28\n(1 row(s) returned)")
    expected = ["Top paid:", "name | salary", "Ravi | 75000.00", "Asha | 90000.50", "Cross join:", "pairs", "28", "Empty set", "(error 1062)"]
    assert sql_results_match(actual, expected)                                          # row order and column aliases are not compared
    assert not sql_results_match(actual, ["name | salary", "Asha | 90000.5"])           # but values are: MySQL prints 90000.50
    assert not sql_results_match(actual, ["name | salary", "Asha | 90000.50"])          # a block must equal the whole result set
    assert not sql_results_match(actual, ["A:", "pairs", "28", "B:", "name | salary", "Ravi | 75000.00", "Asha | 90000.50"])  # blocks keep their order


def test_distributed_output_ignores_timestamps_and_merged_process_lines():
    from app.services.evidence_planner import distributed_output_matches, plan_experiment, verification_summary
    actual = "[17:17:35.827036900] Server up\n[17:17:35.9] Node 0 enters\nClient says hi\n[17:17:36.1] Node 0 leaves\nServer done"
    assert distributed_output_matches(actual, ["Node 0 enters", "Node 0 leaves"])
    assert not distributed_output_matches(actual, ["Node 0 leaves", "Node 0 enters"])     # order matters
    simulation = plan_experiment("EXPERIMENT NO. 4: Token ring\nSimulate 4 nodes.\nExpected output:\nNode 0 enters\nNode 0 leaves", "distributed")
    assert verification_summary(simulation, True, actual)["status"] == "verified"         # simulation verified by its output
    networked = plan_experiment("EXPERIMENT NO. 1: Echo\nWrite a server and client using sockets.\nExpected output:\nNode 0 enters", "distributed")
    assert verification_summary(networked, True, actual)["status"] != "verified"          # real networking still needs the independent check
