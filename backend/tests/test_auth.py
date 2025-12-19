"""
Basic authentication and authorization tests
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models import User
from app.security.jwt import create_access_token
import bcrypt


# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
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
def test_user(db):
    """Create a test user"""
    hashed_password = bcrypt.hashpw("TestPassword123!".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash=hashed_password,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_signup_success(client, db):
    """Test successful user signup"""
    response = client.post(
        "/api/basic-auth/signup",
        json={
            "email": "newuser@example.com",
            "name": "New User",
            "password": "SecurePass123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "csrf_token" in data
    assert data["user"]["email"] == "newuser@example.com"


def test_signup_duplicate_email(client, db, test_user):
    """Test signup with duplicate email"""
    response = client.post(
        "/api/basic-auth/signup",
        json={
            "email": test_user.email,
            "name": "Another User",
            "password": "SecurePass123!"
        }
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client, db, test_user):
    """Test successful login"""
    response = client.post(
        "/api/basic-auth/login",
        json={
            "email": test_user.email,
            "password": "TestPassword123!"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert "csrf_token" in data


def test_login_invalid_password(client, db, test_user):
    """Test login with invalid password"""
    response = client.post(
        "/api/basic-auth/login",
        json={
            "email": test_user.email,
            "password": "WrongPassword123!"
        }
    )
    assert response.status_code == 401


def test_get_current_user_with_token(client, db, test_user):
    """Test getting current user with valid JWT token"""
    token = create_access_token(data={"sub": str(test_user.id), "email": test_user.email})
    response = client.get(
        "/api/basic-auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == test_user.email


def test_get_current_user_without_token(client, db):
    """Test getting current user without token"""
    response = client.get("/api/basic-auth/profile")
    assert response.status_code in (401, 403)  # Unauthorized


def test_refresh_token(client, db, test_user):
    """Test token refresh"""
    from app.security.jwt import create_refresh_token
    refresh_token = create_refresh_token(data={"sub": str(test_user.id), "email": test_user.email})
    
    response = client.post(
        "/api/basic-auth/refresh",
        json={"refresh_token": refresh_token}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data

