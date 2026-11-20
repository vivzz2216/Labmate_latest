"""Android Studio replica builds Java Android projects in an isolated environment via /api/ide/android/*."""
import asyncio
import base64
import io
import shutil
import zipfile
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.csrf import require_csrf_token
from app.routers import ide_android
from app.security.execution_access import execution_user

pytestmark = pytest.mark.skipif(not shutil.which("javac") or not shutil.which("java"), reason="a JDK is required")


SAMPLE_FILES = {
    "app/src/main/AndroidManifest.xml": """<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.studentapp">
    <application android:label="@string/app_name">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <activity android:name=".SecondActivity" android:exported="false" />
    </application>
</manifest>
""",
    "app/src/main/res/values/strings.xml": """<resources>
    <string name="app_name">Student Portal</string>
</resources>
""",
    "app/src/main/res/layout/activity_main.xml": """<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    <EditText
        android:id="@+id/etName"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:hint="Enter name" />
    <TextView
        android:id="@+id/tvGreeting"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Welcome" />
    <Button
        android:id="@+id/btnNext"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Open Details" />
</LinearLayout>
""",
    "app/src/main/java/com/example/studentapp/MainActivity.java": """package com.example.studentapp;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        EditText etName = findViewById(R.id.etName);
        TextView tvGreeting = findViewById(R.id.tvGreeting);
        Button btnNext = findViewById(R.id.btnNext);
        btnNext.setOnClickListener(v -> {
            String name = etName.getText().toString().trim();
            if (name.isEmpty()) {
                Toast.makeText(MainActivity.this, "Enter name", Toast.LENGTH_SHORT).show();
                Log.w("MainActivity", "Blank name submitted");
                return;
            }
            tvGreeting.setText("Hello " + name);
            Intent intent = new Intent(MainActivity.this, SecondActivity.class);
            intent.putExtra("student_name", name);
            startActivity(intent);
        });
    }
}
""",
    "app/src/main/java/com/example/studentapp/SecondActivity.java": """package com.example.studentapp;

import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;

public class SecondActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String name = getIntent().getStringExtra("student_name");
        if (name != null) {
            finish();
        }
    }
}
""",
    "app/src/test/java/com/example/studentapp/ExampleUnitTest.java": """package com.example.studentapp;

import org.junit.Test;
import static org.junit.Assert.*;

public class ExampleUnitTest {
    @Test
    public void addition_isCorrect() {
        assertEquals(4L, (long) (2 + 2));
    }
}
""",
}


@pytest.fixture()
def client():
    ide_android._recent.clear()
    ide_android._busy.clear()
    app = FastAPI()
    app.include_router(ide_android.router, prefix="/api")
    app.dependency_overrides[execution_user] = lambda: SimpleNamespace(id=11, email="student@example.com")
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as test_client:
        yield test_client


def test_capabilities_report_honest_tools(client):
    res = client.get("/api/ide/android/capabilities")
    assert res.status_code == 200
    body = res.json()
    assert body["javac_available"] is True
    assert body["native_emulator_available"] is False


def test_real_javac_compile_and_apk_archive(client):
    res = client.post(
        "/api/ide/android/build",
        json={"files": SAMPLE_FILES, "task": "assembleDebug", "package_name": "com.example.studentapp"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True, data
    assert data["diagnostics"] == []
    assert "com/example/studentapp/MainActivity.class" in data["compiled_classes"]
    assert "com/example/studentapp/SecondActivity.class" in data["compiled_classes"]
    assert "com/example/studentapp/R.class" in data["compiled_classes"]
    artifact = data["artifact"]
    assert artifact is not None and artifact["filename"] == "app-debug.apk"
    raw = base64.b64decode(artifact["base64"])
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        names = set(zf.namelist())
        assert "AndroidManifest.xml" in names
        assert "classes/com/example/studentapp/MainActivity.class" in names
        assert "res/layout/activity_main.xml" in names


def test_real_java_syntax_error_surfaces_in_diagnostics(client):
    broken = dict(SAMPLE_FILES)
    broken["app/src/main/java/com/example/studentapp/MainActivity.java"] = (
        broken["app/src/main/java/com/example/studentapp/MainActivity.java"].replace("setContentView(R.layout.activity_main);", "int broken = ;")
    )
    res = client.post(
        "/api/ide/android/build",
        json={"files": broken, "task": "compile", "package_name": "com.example.studentapp"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is False
    assert data["diagnostics"]
    first = data["diagnostics"][0]
    assert first["severity"] == "error"
    assert "MainActivity.java" in first["file"]
    assert "illegal start of expression" in first["message"]
    assert "Temp" not in first["file"] and "/tmp/" not in first["file"]


def test_malformed_xml_and_xxe_rejected(client):
    bad_xml = dict(SAMPLE_FILES)
    bad_xml["app/src/main/res/layout/activity_main.xml"] = "<LinearLayout><TextView></LinearLayout>"
    res = client.post("/api/ide/android/build", json={"files": bad_xml, "task": "compile", "package_name": "com.example.studentapp"})
    assert res.status_code == 200
    assert res.json()["success"] is False
    assert res.json()["diagnostics"][0]["file"] == "app/src/main/res/layout/activity_main.xml"

    xxe = dict(SAMPLE_FILES)
    xxe["app/src/main/res/layout/activity_main.xml"] = "<!DOCTYPE foo [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><LinearLayout/>"
    res2 = client.post("/api/ide/android/build", json={"files": xxe, "task": "compile", "package_name": "com.example.studentapp"})
    assert res2.status_code == 200
    assert res2.json()["success"] is False
    assert "DOCTYPE" in res2.json()["diagnostics"][0]["message"]


def test_unit_test_task_runs_compiled_junit_tests(client):
    res = client.post(
        "/api/ide/android/build",
        json={"files": SAMPLE_FILES, "task": "test", "package_name": "com.example.studentapp"},
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True, data
    joined = "\n".join(data["logs"])
    assert "ExampleUnitTest > addition_isCorrect PASSED" in joined


def test_security_policy_and_auth_and_rate_limits(client):
    unsafe = dict(SAMPLE_FILES)
    unsafe["app/src/main/java/com/example/studentapp/MainActivity.java"] = (
        "package com.example.studentapp;\npublic class MainActivity { void x() throws Exception { Runtime.getRuntime().exec(\"id\"); } }"
    )
    res = client.post("/api/ide/android/build", json={"files": unsafe, "task": "compile", "package_name": "com.example.studentapp"})
    assert res.status_code == 200
    assert res.json()["success"] is False
    assert "Security policy violation" in res.json()["error"]

    # Path traversal validation
    bad_path = {"../escape.java": "class A {}"}
    assert client.post("/api/ide/android/build", json={"files": bad_path, "task": "compile"}).status_code == 422

    # Rate limit
    ide_android._recent[11].extend([__import__("time").monotonic()] * ide_android.BUILDS_PER_MINUTE)
    assert client.post("/api/ide/android/build", json={"files": SAMPLE_FILES, "task": "clean"}).status_code == 429
    ide_android._recent.clear()

    # Concurrency lock
    lock = asyncio.Lock()
    asyncio.run(lock.acquire())
    ide_android._busy[11] = lock
    assert client.post("/api/ide/android/build", json={"files": SAMPLE_FILES, "task": "clean"}).status_code == 409


def test_anonymous_rejected():
    app = FastAPI()
    app.include_router(ide_android.router, prefix="/api")
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as anon:
        assert anon.post("/api/ide/android/build", json={"files": SAMPLE_FILES, "task": "compile"}).status_code in (401, 403)
