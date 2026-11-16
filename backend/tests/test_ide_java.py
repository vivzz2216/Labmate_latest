"""Eclipse / IntelliJ replicas run Java on the real JDK through /api/ide/java/run."""
import asyncio
import shutil
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.csrf import require_csrf_token
from app.routers import ide_java
from app.security.execution_access import execution_user

pytestmark = pytest.mark.skipif(not shutil.which("javac") or not shutil.which("java"), reason="a JDK is required")


@pytest.fixture()
def client():
    ide_java._recent.clear()
    ide_java._busy.clear()
    app = FastAPI()
    app.include_router(ide_java.router, prefix="/api")
    app.dependency_overrides[execution_user] = lambda: SimpleNamespace(id=7, email="s@example.com")
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as test_client:
        yield test_client


def run(client, code, stdin=""):
    reply = client.post("/api/ide/java/run", json={"code": code, "stdin": stdin})
    assert reply.status_code == 200, reply.text
    return reply.json()


def test_real_java_semantics_and_stdin(client):
    code = ("import java.util.*; public class Calc { public static void main(String[] a) { Scanner sc = new Scanner(System.in);"
            " int x = sc.nextInt(); System.out.println(7 / 2); System.out.println('a' + 1); System.out.println(1.0);"
            " System.out.println(Integer.MAX_VALUE + 1); System.out.println(5 / 2 * 2.0); System.out.println(x * 2); } }")
    out = run(client, code, "21\n")
    assert out["success"] and out["phase"] == "run" and out["class_name"] == "Calc" and out["exit_code"] == 0
    assert out["stdout"].split() == ["3", "98", "1.0", "-2147483648", "4.0", "42"]


def test_stdout_before_an_uncaught_exception_is_kept_and_stderr_is_separate(client):
    out = run(client, "public class A { public static void main(String[] a) { System.out.println(\"start\"); int[] v = new int[2]; System.out.println(v[5]); } }")
    assert not out["success"] and out["phase"] == "run" and out["exit_code"] == 1
    assert out["stdout"].strip() == "start"
    assert "ArrayIndexOutOfBoundsException: Index 5 out of bounds for length 2" in out["stderr"] and "at A.main(A.java:1)" in out["stderr"]
    div = run(client, "public class D { public static void main(String[] a) { System.out.println(10 / Integer.parseInt(\"0\")); } }")
    assert "ArithmeticException: / by zero" in div["stderr"] and div["exit_code"] == 1


def test_compile_errors_report_file_and_line_without_server_paths(client):
    out = run(client, "public class Bad {\n  public static void main(String[] a) {\n    int x = ;\n  }\n}\n")
    assert out["phase"] == "compile" and not out["success"] and out["stdout"] == ""
    assert out["stderr"].startswith("Bad.java:3: error: illegal start of expression")
    assert "Temp" not in out["stderr"] and "\\" not in out["stderr"].splitlines()[0] and "/tmp" not in out["stderr"]


def test_valid_oop_program_that_the_old_interpreter_rejected(client):
    code = ("public class Shapes { interface D { String d(); } static abstract class S implements D { abstract double a(); public String d() { return getClass().getSimpleName() + \" \" + a(); } }"
            " static class Sq extends S { double s; Sq(double s) { this.s = s; } double a() { return s * s; } }"
            " static class E extends Exception { E(String m) { super(m); } }"
            " public static void main(String[] x) throws Exception { System.out.println(new Sq(3).d()); try { throw new E(\"boom\"); } catch (E e) { System.out.println(e.getMessage()); } } }")
    out = run(client, code)
    assert out["success"] and out["stdout"].splitlines() == ["Sq 9.0", "boom"]


def test_no_class_and_size_limits(client):
    assert run(client, "int x = 1;")["stderr"].startswith("error: no class declaration found")
    assert client.post("/api/ide/java/run", json={"code": "x" * (ide_java.MAX_CODE_CHARS + 1)}).status_code == 422
    assert client.post("/api/ide/java/run", json={"code": "class A{}", "stdin": "x" * (ide_java.MAX_STDIN_CHARS + 1)}).status_code == 422
    assert client.post("/api/ide/java/run", json={"code": ""}).status_code == 422


def test_runs_are_rate_limited_per_account(client):
    ide_java._recent[7].extend([__import__("time").monotonic()] * ide_java.RUNS_PER_MINUTE)
    reply = client.post("/api/ide/java/run", json={"code": "public class A { public static void main(String[] a) {} }"})
    assert reply.status_code == 429
    ide_java._recent.clear()
    assert client.post("/api/ide/java/run", json={"code": "public class A { public static void main(String[] a) {} }"}).status_code == 200


def test_a_second_run_while_one_is_in_flight_is_refused(client):
    lock = asyncio.Lock()
    asyncio.run(lock.acquire())
    ide_java._busy[7] = lock
    reply = client.post("/api/ide/java/run", json={"code": "public class A { public static void main(String[] a) {} }"})
    assert reply.status_code == 409


def test_anonymous_users_cannot_run_code():
    app = FastAPI()
    app.include_router(ide_java.router, prefix="/api")
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as anonymous:
        assert anonymous.post("/api/ide/java/run", json={"code": "class A{}"}).status_code in (401, 403)


def test_clean_messages_strips_directories():
    text = "Compilation error: C:\\Users\\x\\AppData\\Local\\Temp\\tmp1\\Foo.java:4: error: ';' expected\n  int x\n       ^\n/tmp/a/b/Foo.java:9: error: oops"
    assert ide_java.clean_messages(text, "Foo") == "Foo.java:4: error: ';' expected\n  int x\n       ^\nFoo.java:9: error: oops"
