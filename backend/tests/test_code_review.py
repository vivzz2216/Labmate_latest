"""Tests for the AI code review endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app
from app.middleware.csrf import require_csrf_token
from app.models import User
from app.security.jwt import create_access_token
import bcrypt


SQLALCHEMY_DATABASE_URL = "sqlite:///./code_review_test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


async def override_csrf():
    return True


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[require_csrf_token] = override_csrf


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client():
    return TestClient(app)


@pytest.fixture(scope="function")
def auth_headers(db):
    hashed_password = bcrypt.hashpw("SecurePass123!".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = User(email="reviewer@example.com", name="Vivek Pillai", password_hash=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": str(user.id), "email": user.email})
    return {"Authorization": f"Bearer {token}", "X-CSRF-Token": "test-token"}


def test_review_endpoint_returns_personalized_code(client, auth_headers):
    sample_code = """
class BadStack:
    def __init__(self):
        self.data = []
    def push(self, item):
        with open('temp.txt', 'w') as f:
            f.write(str(item))
        self.data.append(item)
"""
    files = {"file": ("assignment.py", sample_code, "text/x-python")}
    data = {"problem_statement": "Implement a stack using an array"}
    response = client.post("/api/ai-review/review", files=files, data=data, headers=auth_headers)
    assert response.status_code == 200
    payload = response.json()
    assert payload["original_filename"] == "assignment.py"
    assert "review_id" in payload
    assert payload["model_source"] in {"heuristic", "claude"}
    assert "improved_code" in payload and "ArrayStack" in payload["improved_code"]
    assert "personalized_code" in payload
    assert "Vivek Pillai" in payload["personalized_code"]
    assert payload["issues"], "Issues list should not be empty"


def test_variant_endpoint_returns_alternate_solution(client, auth_headers):
    original_code = "def solve():\n    return [1, 2, 3]\n"
    payload = {
        "original_code": original_code,
        "problem_statement": "Implement a stack using an array",
        "review_id": "seed-review",
    }
    response = client.post("/api/ai-review/variant", json=payload, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["regenerated"] is True
    assert data["variant_of"] == "seed-review"
    assert "Alternate approach" in data["improved_code"]
    assert "personalized_code" in data

