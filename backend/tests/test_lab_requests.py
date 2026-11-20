import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import LabRequest, StudentFeedback, User
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.routers.lab_requests import router as lab_requests_router
from app.routers.feedback import router as feedback_router


@pytest.fixture
def app_and_db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine)

    with session_factory() as db:
        user1 = User(id=1, name='Aarav Patel', email='aarav@example.edu', password_hash='hash1')
        user2 = User(id=2, name='Riya Sharma', email='riya@example.edu', password_hash='hash2')
        db.add_all([user1, user2])
        db.commit()

    app = FastAPI()
    app.include_router(lab_requests_router, prefix='/api')
    app.include_router(feedback_router, prefix='/api')

    active_user = {'user_id': 1}

    def db_override():
        with session_factory() as db:
            yield db

    def auth_override():
        uid = active_user.get('user_id')
        if not uid:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Unauthorized")
        with session_factory() as db:
            user = db.query(User).filter(User.id == uid).first()
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user

    def csrf_override():
        return True

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_current_user] = auth_override
    app.dependency_overrides[require_csrf_token] = csrf_override

    with TestClient(app) as client:
        yield client, session_factory, active_user

    engine.dispose()


def test_authenticated_student_can_create_lab_request(app_and_db):
    client, session_factory, active_user = app_and_db
    active_user['user_id'] = 1

    payload = {
        "question": "What lab do you need?",
        "lab_name": "Android Studio Lab",
        "details": "Need experiments for Jetpack Compose and Activities"
    }
    res = client.post("/api/lab-requests", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["ok"] is True
    assert data["lab_name"] == "Android Studio Lab"
    assert data["status"] == "received"
    assert "id" in data

    # Verify persisted in DB
    with session_factory() as db:
        saved = db.query(LabRequest).filter(LabRequest.id == data["id"]).first()
        assert saved is not None
        assert saved.user_id == 1
        assert saved.question == "What lab do you need?"
        assert saved.lab_name == "Android Studio Lab"
        assert saved.details == "Need experiments for Jetpack Compose and Activities"
        assert saved.status == "received"


def test_lab_request_validation(app_and_db):
    client, _, active_user = app_and_db
    active_user['user_id'] = 1

    # Empty lab name
    res = client.post("/api/lab-requests", json={"lab_name": "  "})
    assert res.status_code == 400

    # Missing lab name
    res = client.post("/api/lab-requests", json={"details": "only details"})
    assert res.status_code in (400, 422)


def test_unauthenticated_cannot_create_lab_request(app_and_db):
    client, _, active_user = app_and_db
    active_user['user_id'] = None  # Not signed in

    res = client.post("/api/lab-requests", json={"lab_name": "MATLAB"})
    assert res.status_code == 401


def test_get_my_lab_requests_scopes_to_user(app_and_db):
    client, session_factory, active_user = app_and_db
    
    with session_factory() as db:
        db.add(LabRequest(user_id=1, question="What lab do you need?", lab_name="MATLAB", details="Signal processing"))
        db.add(LabRequest(user_id=2, question="What lab do you need?", lab_name="NS2", details="Tcl scripts"))
        db.commit()

    # User 1
    active_user['user_id'] = 1
    res = client.get("/api/lab-requests/my")
    assert res.status_code == 200
    reqs = res.json()["requests"]
    assert len(reqs) == 1
    assert reqs[0]["lab_name"] == "MATLAB"

    # User 2
    active_user['user_id'] = 2
    res2 = client.get("/api/lab-requests/my")
    assert res2.status_code == 200
    reqs2 = res2.json()["requests"]
    assert len(reqs2) == 1
    assert reqs2[0]["lab_name"] == "NS2"


def test_get_my_feedback_and_homepage_reviews(app_and_db):
    client, session_factory, active_user = app_and_db
    active_user['user_id'] = 1

    # Submit feedback via POST /api/feedback
    fb_res = client.post("/api/feedback", json={"rating": 5, "message": "LabMate completed my entire Java manual with code and screenshots!"})
    assert fb_res.status_code == 200
    assert fb_res.json()["ok"] is True

    # User 1 can see their feedback via GET /api/feedback/my
    my_fb = client.get("/api/feedback/my")
    assert my_fb.status_code == 200
    fb_list = my_fb.json()["feedback"]
    assert len(fb_list) == 1
    assert fb_list[0]["rating"] == 5
    assert "LabMate completed" in fb_list[0]["message"]

    # Public reviews on homepage should include this rated feedback
    public_res = client.get("/api/feedback/reviews")
    assert public_res.status_code == 200
    reviews_data = public_res.json()
    assert reviews_data["total"] >= 1
    assert reviews_data["average_rating"] == 5.0
    first_review = reviews_data["reviews"][0]
    assert first_review["rating"] == 5
    assert "LabMate completed" in first_review["message"]
    # Verify student_name formatting protects identity (e.g. "Aarav P.")
    assert first_review.get("student_name") == "Aarav P."
