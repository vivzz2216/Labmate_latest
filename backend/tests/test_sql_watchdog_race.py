from concurrent.futures import ThreadPoolExecutor

import pytest

from app.services.sql_runtime import SQLSession


def _timeout_then_follow_up(_):
    session = SQLSession(timeout=0.6)
    try:
        slow = session.execute("SELECT SLEEP(5);")
        follow_up = session.execute("SELECT 1 + 1 AS two;")
        return slow["success"], follow_up["success"], follow_up.get("error")
    finally:
        session.close()


def test_late_watchdog_never_kills_the_next_statement_under_load():
    try:
        SQLSession(timeout=1).close()
    except Exception as exc:
        pytest.skip(f"MySQL is not available: {exc}")
    with ThreadPoolExecutor(max_workers=8) as pool:
        outcomes = list(pool.map(_timeout_then_follow_up, range(16)))
    assert all(slow is False for slow, _, _ in outcomes)
    assert all(ok for _, ok, _ in outcomes), [err for _, ok, err in outcomes if not ok]
