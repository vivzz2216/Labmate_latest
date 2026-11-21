import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routers.lab_catalog import router as lab_catalog_router
from app.routers.workflows import QuestionInput, ProcessInput

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
    assert data["default_language"] == "auto"
    assert data["experiment_count"] == 0
    assert data["experiments"] == []
    envs = [spec["value"] for spec in data["environment_specs"] if spec["label"] == "Environments"]
    assert envs == ["Google Colab, Jupyter Notebook, R / RStudio"]


def test_get_distributed_computing_catalog(client):
    response = client.get("/api/labs/distributed-computing")
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "distributed-computing"
    assert data["track"] == "distributed"
    assert data["default_language"] == "distributed"
    assert data["experiment_count"] == 0
    assert data["experiments"] == []


def test_get_nonexistent_lab_returns_404(client):
    response = client.get("/api/labs/quantum-computing")
    assert response.status_code == 404


def test_every_lab_category_detail_returns_no_hardcoded_experiments(client):
    listing = client.get("/api/labs").json()
    assert len(listing) == 10
    for summary in listing:
        slug = summary["slug"]
        assert summary["experiment_count"] == 0
        detail = client.get(f"/api/labs/{slug}").json()
        assert detail["slug"] == slug
        assert detail["experiments"] == []
        assert detail["experiment_count"] == 0
        if slug in {"deep-learning", "colab", "social-media-analytics"}:
            envs = [spec["value"] for spec in detail["environment_specs"] if spec["label"] == "Environments"]
            assert envs == ["Google Colab, Jupyter Notebook, R / RStudio"]


def test_manual_first_extraction_and_notebook_environment_options():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool

    from app.database import Base, get_db
    from app.middleware.auth import get_current_user
    from app.middleware.csrf import require_csrf_token
    from app.models import AssignmentWorkflow, Upload, User
    from app.routers import workflows
    from app.services.manual_sections import numbered_experiments
    from conftest import student_profile

    flask_manual = """Flask Web Development Lab
Experiment 1: Student Registration Form in Flask
Aim: Build a Flask web form collecting student name and email with server-side validation.
Experiment 2: Flask JSON API & Template Routing
Aim: Serve a dynamic Jinja template and JSON API route in Python Flask."""
    flask_tasks = numbered_experiments(flask_manual)
    assert [t["language"] for t in flask_tasks] == ["python", "python"]
    assert "Student Registration" in flask_tasks[0]["text"]
    assert "Template Routing" in flask_tasks[1]["text"]

    dl_manual = """Deep Learning Laboratory
Experiment 1: Perceptron & MLP in PyTorch
Aim: Train an MLP classifier on synthetic tabular features using PyTorch.
Experiment 2: CNN Image Classifier in TensorFlow
Aim: Implement a compact TensorFlow Keras CNN and plot epoch loss.
Experiment 3: LSTM Sequence Model
Aim: Build and evaluate an LSTM sequence classifier in Keras."""
    dl_tasks = numbered_experiments(dl_manual)
    assert [t["language"] for t in dl_tasks] == ["colab", "colab", "colab"]
    assert [t["text"] for t in dl_tasks] != [t["text"] for t in flask_tasks]

    r_manual = """Statistical Data Science Lab
Experiment 1: Linear Regression and ggplot2 Visualization using RStudio
Aim: Fit a linear model on mtcars and plot residuals using ggplot2 in RStudio.
Experiment 2: Decision Tree with rpart in R
Aim: Train a classification tree with rpart and display confusion metrics in R."""
    r_tasks = numbered_experiments(r_manual)
    assert [t["language"] for t in r_tasks] == ["r", "r"]

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email="nb@example.com", name="Notebook Student", profile=student_profile())
        db.add(user)
        db.flush()
        upload_ids = []
        for idx in range(3):
            up = Upload(
                user_id=user.id,
                filename=f"dl_{idx}.pdf",
                original_filename=f"dl_{idx}.pdf",
                file_path="unused",
                file_type="pdf",
                file_size=1,
            )
            db.add(up)
            db.flush()
            db.add(
                AssignmentWorkflow(
                    upload_id=up.id,
                    status="ready",
                    stage="review",
                    progress=20,
                    language="auto",
                    questions=[{"id": 1, "text": dl_tasks[0]["text"], "language": "colab"}],
                    results=[],
                    output_name=f"dl_{idx}",
                )
            )
            upload_ids.append(up.id)
        db.commit()
        user_id = user.id

    route_app = FastAPI()
    route_app.include_router(workflows.router, prefix="/api")

    def session():
        with factory() as db:
            yield db

    route_app.dependency_overrides[get_db] = session
    route_app.dependency_overrides[get_current_user] = lambda: User(
        id=user_id, email="nb@example.com", name="Notebook Student", is_active=True, profile=student_profile()
    )
    route_app.dependency_overrides[require_csrf_token] = lambda: True

    try:
        with TestClient(route_app) as route_client:
            # 1. Google Colab environment
            r1 = route_client.post(
                f"/api/workflows/{upload_ids[0]}/process",
                json={
                    "questions": [{"id": 1, "text": dl_tasks[0]["text"], "language": "colab", "notebook_template": "colab", "colab_theme": "dark"}],
                    "language": "colab",
                    "track": "deep_learning",
                },
            )
            assert r1.status_code == 200, r1.text
            assert r1.json()["questions"][0]["language"] == "colab"
            assert r1.json()["questions"][0]["notebook_template"] == "colab"

            # 2. Jupyter Notebook environment
            r2 = route_client.post(
                f"/api/workflows/{upload_ids[1]}/process",
                json={
                    "questions": [{"id": 1, "text": dl_tasks[1]["text"], "language": "colab", "notebook_template": "jupyter", "jupyter_theme": "dark"}],
                    "language": "colab",
                    "track": "deep_learning",
                },
            )
            assert r2.status_code == 200, r2.text
            assert r2.json()["questions"][0]["language"] == "colab"
            assert r2.json()["questions"][0]["notebook_template"] == "jupyter"
            assert r2.json()["questions"][0]["jupyter_theme"] == "dark"

            # 3. R / RStudio environment override on extracted colab task
            r3 = route_client.post(
                f"/api/workflows/{upload_ids[2]}/process",
                json={
                    "questions": [{"id": 1, "text": dl_tasks[0]["text"], "language": "colab", "rstudio_theme": "dark"}],
                    "language": "r",
                    "track": "deep_learning",
                },
            )
            assert r3.status_code == 200, r3.text
            assert r3.json()["questions"][0]["language"] == "r"
            assert r3.json()["questions"][0]["rstudio_theme"] == "dark"
    finally:
        engine.dispose()


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
