from app.services.sqlite_runtime import execute_sqlite_script
from app.services.sql_runtime import verify_sql_exercise


def test_sqlite_captures_trigger_results_after_real_execution():
    sql = """CREATE TABLE marks (score INTEGER);
CREATE TABLE ledger (event TEXT, score INTEGER);
CREATE TRIGGER log_score AFTER INSERT ON marks BEGIN
  INSERT INTO ledger VALUES ('added', NEW.score);
  INSERT INTO ledger VALUES ('verified', NEW.score);
END;
INSERT INTO marks VALUES (42);
SELECT * FROM marks;
SELECT * FROM ledger;
"""
    receipt = execute_sqlite_script(sql)
    assert receipt["success"], receipt["error"]
    assert receipt["select_results"][-1]["rows"] == [
        {"event": "added", "score": 42},
        {"event": "verified", "score": 42},
    ]
    assert verify_sql_exercise("Show the trigger output", sql, receipt)["verified"]


def test_sqlite_disallows_opening_a_second_database(tmp_path):
    database_path = tmp_path / "outside.sqlite"
    receipt = execute_sqlite_script(f"ATTACH DATABASE '{database_path.as_posix()}' AS outside;")
    assert not receipt["success"]
    assert not database_path.exists()
