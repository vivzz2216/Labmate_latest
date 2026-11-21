import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import User
from app.routers import admin as admin_router
from app.routers.community import router


@pytest.fixture
def env():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)
    with session() as db:
        for name in ("Asha", "Rohan", "Owner"):
            db.add(User(name=name, email=f"{name.lower()}@example.org", password_hash="x"))
        db.commit()
    who = {"id": 1}
    app = FastAPI()
    app.include_router(router, prefix="/api")

    def database():
        with session() as db:
            yield db

    def current():
        with session() as db:
            return db.query(User).filter(User.id == who["id"]).first()

    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = current
    app.dependency_overrides[require_csrf_token] = lambda: True
    app.dependency_overrides[admin_router.require_admin] = lambda: current() if who["id"] == 3 else (_ for _ in ()).throw(__import__("fastapi").HTTPException(403, "owner only"))
    with TestClient(app) as client:
        yield client, who
    engine.dispose()


def make_poll(client, who, **extra):
    who["id"] = 3
    body = {"question": "Which lab track should we add next?", "options": ["Docker", "Kubernetes", "Flutter"]}
    body.update(extra)
    response = client.post("/api/admin/polls", json=body)
    who["id"] = 1
    return response


def test_owner_creates_poll_and_students_vote_once_each(env):
    client, who = env
    created = make_poll(client, who)
    assert created.status_code == 200
    poll = created.json()
    assert poll["open"] and [o["label"] for o in poll["options"]] == ["Docker", "Kubernetes", "Flutter"]
    docker, kube = poll["options"][0]["id"], poll["options"][1]["id"]

    assert client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": docker}).status_code == 200
    who["id"] = 2
    assert client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": docker}).status_code == 200
    who["id"] = 1
    result = client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": kube}).json()  # Asha changes her vote
    assert result["total_votes"] == 2 and result["my_option_id"] == kube
    votes = {o["label"]: o["votes"] for o in result["options"]}
    assert votes == {"Docker": 1, "Kubernetes": 1, "Flutter": 0}
    assert sum(o["percent"] for o in result["options"]) == 100.0


def test_summary_counts_unanswered_polls_and_latest_update(env):
    client, who = env
    poll = make_poll(client, who).json()
    assert client.get("/api/community/summary").json() == {"latest_update_id": 0, "unanswered_polls": 1}
    client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": poll["options"][0]["id"]})
    who["id"] = 3
    update = client.post("/api/admin/updates", json={"title": "Power BI Power Query", "body": "Edit data with Applied Steps.", "tag": "New"}).json()
    who["id"] = 1
    assert client.get("/api/community/summary").json() == {"latest_update_id": update["id"], "unanswered_polls": 0}


def test_vote_rules(env):
    client, who = env
    poll = make_poll(client, who).json()
    other = make_poll(client, who, question="Another question here?").json()
    assert client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": other["options"][0]["id"]}).status_code == 400
    assert client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": "1"}).status_code == 400
    assert client.post("/api/polls/9999/vote", json={"option_id": 1}).status_code == 404
    who["id"] = 3
    assert client.post(f"/api/admin/polls/{poll['id']}/close").json()["open"] is False
    who["id"] = 1
    assert client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": poll["options"][0]["id"]}).status_code == 409


def test_poll_validation_and_owner_only(env):
    client, who = env
    assert client.post("/api/admin/polls", json={"question": "Which one is better?", "options": ["Only one"]}).status_code == 403  # student
    assert make_poll(client, who, options=["Same", "same"]).status_code == 400
    assert make_poll(client, who, options=["a"] * 9).status_code == 400
    assert make_poll(client, who, question="x").status_code == 400
    assert make_poll(client, who, closes_in_days=0).status_code == 400
    assert make_poll(client, who, closes_in_days=7).json()["closes_at"]


def test_updates_are_public_newest_first_and_validated(env):
    client, who = env
    who["id"] = 3
    assert client.post("/api/admin/updates", json={"title": "A new thing", "body": "Details here", "tag": "Nope"}).status_code == 400
    first = client.post("/api/admin/updates", json={"title": "First change", "body": "Details one"}).json()
    second = client.post("/api/admin/updates", json={"title": "Second change", "body": "Details two", "tag": "Improved"}).json()
    who["id"] = 1
    listing = client.get("/api/updates").json()["updates"]
    assert [u["id"] for u in listing] == [second["id"], first["id"]]
    assert client.delete(f"/api/admin/updates/{first['id']}").status_code == 403
    who["id"] = 3
    assert client.delete(f"/api/admin/updates/{first['id']}").status_code == 200
    assert [u["id"] for u in client.get("/api/updates").json()["updates"]] == [second["id"]]


def test_deleting_a_poll_removes_its_votes(env):
    client, who = env
    poll = make_poll(client, who).json()
    client.post(f"/api/polls/{poll['id']}/vote", json={"option_id": poll["options"][0]["id"]})
    who["id"] = 3
    assert client.delete(f"/api/admin/polls/{poll['id']}").status_code == 200
    who["id"] = 1
    assert client.get("/api/polls").json()["polls"] == []
