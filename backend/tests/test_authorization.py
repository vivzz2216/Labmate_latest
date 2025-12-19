"""
Authorization tests - verify users can only access their own resources
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import User, Upload
from app.security.jwt import create_access_token
import bcrypt
from datetime import datetime


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_auth.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test"""
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client():
    """Create a test client"""
    return TestClient(app)


@pytest.fixture(scope="function")
def user1(db):
    """Create first test user"""
    hashed_password = bcrypt.hashpw("Password123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        email="user1@example.com",
        name="User One",
        password_hash=hashed_password,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def user2(db):
    """Create second test user"""
    hashed_password = bcrypt.hashpw("Password123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        email="user2@example.com",
        name="User Two",
        password_hash=hashed_password,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture(scope="function")
def upload_user1(db, user1):
    """Create upload owned by user1"""
    upload = Upload(
        filename="test1.docx",
        original_filename="test1.docx",
        file_path="/tmp/test1.docx",
        file_type="docx",
        file_size=1000,
        user_id=user1.id,
        uploaded_at=datetime.utcnow()
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


@pytest.fixture(scope="function")
def upload_user2(db, user2):
    """Create upload owned by user2"""
    upload = Upload(
        filename="test2.docx",
        original_filename="test2.docx",
        file_path="/tmp/test2.docx",
        file_type="docx",
        file_size=1000,
        user_id=user2.id,
        uploaded_at=datetime.utcnow()
    )
    db.add(upload)
    db.commit()
    db.refresh(upload)
    return upload


def test_user_can_access_own_upload(client, db, user1, upload_user1):
    """Test user can access their own upload"""
    token = create_access_token(data={"sub": str(user1.id), "email": user1.email})
    response = client.get(
        f"/api/parse/{upload_user1.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    # Should not be 403 Forbidden
    assert response.status_code != 403


def test_user_cannot_access_other_user_upload(client, db, user1, upload_user2):
    """Test user cannot access another user's upload"""
    token = create_access_token(data={"sub": str(user1.id), "email": user1.email})
    response = client.get(
        f"/api/parse/{upload_user2.id}",
        headers={"Authorization": f"Bearer {token}"}
    )
    # Should be 403 Forbidden or 404 Not Found
    assert response.status_code in [403, 404]


def test_user_can_access_own_assignments(client, db, user1, upload_user1):
    """Test user can access their own assignments"""
    token = create_access_token(data={"sub": str(user1.id), "email": user1.email})
    response = client.get(
        "/api/assignments/",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    # Should only see own uploads
    assert all(assignment["id"] == upload_user1.id for assignment in data)


def test_user_cannot_access_other_user_assignments(client, db, user1, user2, upload_user2):
    """Test user cannot see another user's assignments"""
    token = create_access_token(data={"sub": str(user1.id), "email": user1.email})
    response = client.get(
        "/api/assignments/",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    # Should not see user2's uploads
    assert not any(assignment["id"] == upload_user2.id for assignment in data)

