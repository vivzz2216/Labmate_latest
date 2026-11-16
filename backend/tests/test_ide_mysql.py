"""The MySQL command-line replica runs statements on a real MySQL server through /api/ide/mysql/execute."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.csrf import require_csrf_token
from app.routers import ide_mysql
from app.security.execution_access import execution_user


def _server_available():
    try:
        session = ide_mysql.SQLSession()
        session.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _server_available(), reason="a MySQL server is required")


@pytest.fixture()
def client():
    ide_mysql._recent.clear()
    ide_mysql._sessions.clear()
    app = FastAPI()
    app.include_router(ide_mysql.router, prefix="/api")
    app.dependency_overrides[execution_user] = lambda: SimpleNamespace(id=11, email="s@example.com")
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as test_client:
        yield test_client
    client_sessions = list(ide_mysql._sessions.values())
    for session, _ in client_sessions:
        session.close()
    ide_mysql._sessions.clear()


def run(client, statement):
    reply = client.post("/api/ide/mysql/execute", json={"statement": statement})
    assert reply.status_code == 200, reply.text
    return reply.json()


def test_session_keeps_state_and_decimal_scale_like_the_real_client(client):
    assert run(client, "CREATE DATABASE shop")["success"]
    assert run(client, "USE shop")["database"] == "shop"
    run(client, "CREATE TABLE item (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(20) NOT NULL, price DECIMAL(10,2))")
    insert = run(client, "INSERT INTO item (name, price) VALUES ('pen', 75000), ('ink', 12.5)")
    assert insert["affected"] == 2 and "Records: 2  Duplicates: 0  Warnings: 0" in insert["info"]
    out = run(client, "SELECT id, name, price FROM item ORDER BY id")
    assert out["columns"] == ["id", "name", "price"]
    assert out["rows"] == [["1", "pen", "75000.00"], ["2", "ink", "12.50"]]
    assert out["numeric"] == [True, False, True]
    update = run(client, "UPDATE item SET price = price + 1")
    assert "Rows matched: 2  Changed: 2  Warnings: 0" in update["info"]
    assert run(client, "SELECT name FROM item WHERE price > 1000000")["rows"] == []


def test_server_errors_keep_code_and_sqlstate_and_hide_the_private_schema(client):
    run(client, "CREATE DATABASE hr")
    run(client, "USE hr")
    run(client, "CREATE TABLE d (id INT PRIMARY KEY)")
    run(client, "CREATE TABLE e (id INT PRIMARY KEY, d INT, FOREIGN KEY (d) REFERENCES d(id))")
    dup = run(client, "INSERT INTO d VALUES (1), (1)")
    assert not dup["success"] and dup["error_code"] == 1062 and dup["sqlstate"] == "23000"
    assert dup["error"] == "Duplicate entry '1' for key 'd.PRIMARY'"
    fk = run(client, "INSERT INTO e VALUES (1, 99)")
    assert fk["error_code"] == 1452 and "`hr`.`e`" in fk["error"] and "lab_" not in fk["error"]
    missing = run(client, "SELECT * FROM nothing")
    assert missing["error_code"] == 1146 and missing["sqlstate"] == "42S02"
    assert run(client, "SELEC 1")["error_code"] == 1064


def test_transactions_views_and_triggers_behave_like_mysql(client):
    run(client, "CREATE DATABASE t1")
    run(client, "USE t1")
    run(client, "CREATE TABLE a (n INT)")
    run(client, "CREATE TABLE log (note VARCHAR(30))")
    run(client, "START TRANSACTION")
    run(client, "INSERT INTO a VALUES (1)")
    run(client, "ROLLBACK")
    assert run(client, "SELECT COUNT(*) FROM a")["rows"] == [["0"]]
    run(client, "CREATE VIEW big AS SELECT n FROM a WHERE n > 5")
    run(client, "CREATE TRIGGER t AFTER INSERT ON a FOR EACH ROW INSERT INTO log VALUES (CONCAT('added ', NEW.n))")
    run(client, "INSERT INTO a VALUES (9)")
    assert run(client, "SELECT * FROM big")["rows"] == [["9"]]
    assert run(client, "SELECT note FROM log")["rows"] == [["added 9"]]


def test_each_account_has_its_own_session_and_reset_drops_it(client):
    run(client, "CREATE DATABASE mine")
    assert client.post("/api/ide/mysql/reset").json() == {"ok": True}
    assert ide_mysql._sessions == {}
    assert run(client, "USE mine")["success"] is False


def test_rate_limit_and_size_limit(client):
    big = client.post("/api/ide/mysql/execute", json={"statement": "SELECT 1" + " " * ide_mysql.MAX_STATEMENT_CHARS})
    assert big.status_code == 422
    ide_mysql.STATEMENTS_PER_MINUTE, saved = 2, ide_mysql.STATEMENTS_PER_MINUTE
    try:
        run(client, "SELECT 1")
        run(client, "SELECT 2")
        assert client.post("/api/ide/mysql/execute", json={"statement": "SELECT 3"}).status_code == 429
    finally:
        ide_mysql.STATEMENTS_PER_MINUTE = saved
