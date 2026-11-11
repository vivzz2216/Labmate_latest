import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from backend.app.routers.lab_catalog import router as lab_catalog_router
from backend.app.routers.workflows import QuestionInput, ProcessInput

app = FastAPI()
app.include_router(lab_catalog_router, prefix="/api")


@pytest.fixture
def client():
    return TestClient(app)


def test_list_labs_catalog(client):
    response = client.get("/api/labs")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    slugs = [item["slug"] for item in data]
    assert "deep-learning" in slugs
    assert "distributed-computing" in slugs
    assert "python" in slugs
    assert "java" in slugs
    assert "c-cpp" in slugs
    assert "web-development" in slugs
    assert "sql" in slugs
    assert "colab" in slugs


def test_get_deep_learning_catalog(client):
    response = client.get("/api/labs/deep-learning")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "deep-learning"
    assert data["track"] == "deep_learning"
    assert data["default_language"] == "colab"
    assert data["experiment_count"] >= 8


def test_get_distributed_computing_catalog(client):
    response = client.get("/api/labs/distributed-computing")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "distributed-computing"
    assert data["track"] == "distributed"
    assert data["default_language"] == "distributed"
    assert data["experiment_count"] >= 8


def test_get_nonexistent_lab_returns_404(client):
    response = client.get("/api/labs/quantum-computing")
    assert response.status_code == 404


def test_workflow_schema_accepts_distributed_and_track():
    q = QuestionInput(
        id=1,
        text="Implement a Java TCP Client-Server program",
        language="distributed",
        track="distributed",
    )
    assert q.language == "distributed"
    assert q.track == "distributed"

    p = ProcessInput(
        questions=[q],
        language="distributed",
        track="distributed",
        instructions="Use loopback sockets",
        output_name="distributed_lab_1",
    )
    assert p.language == "distributed"
    assert p.track == "distributed"
