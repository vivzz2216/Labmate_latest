from types import SimpleNamespace

import pytest
from fastapi import Depends, FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import User
from app.routers.basic_auth import router
from app.security.execution_access import execution_user
from app.security.execution_access import check_execution_access
from app.services.profile_service import UserProfileService, profile_is_complete


@pytest.fixture
def profile_app(tmp_path, monkeypatch):
    monkeypatch.delenv('RAILWAY_ENVIRONMENT_ID', raising=False)
    for key in ['ADMIN_USERID','ADMIN_PASSWORD','EXECUTION_ALLOWED_EMAILS','BETA_TEST_EMAILS']:
        monkeypatch.setattr(settings, key, '')
    engine = create_engine('sqlite:///'+str(tmp_path/'profile.db'), connect_args={'check_same_thread':False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        db.add(User(id=1,email='student@example.test',name='Student'))
        db.commit()
    app = FastAPI()
    app.include_router(router, prefix='/api/basic-auth')
    def database():
        with factory() as db:
            yield db
    def current(db=Depends(get_db)):
        return db.get(User, 1)
    app.dependency_overrides[get_db] = database
    app.dependency_overrides[get_current_user] = current
    app.dependency_overrides[require_csrf_token] = lambda: True
    @app.post('/execute')
    def execute(user=Depends(execution_user)):
        return {'allowed':True}
    with TestClient(app) as client:
        yield client, factory
    engine.dispose()


DETAILS = {'name':'Ananya Rao','institution':'Example Engineering College','course':'Information Technology',
           'profile_metadata':{'roll_number':'IT042','year':'3rd Year','graduation_year':'2028'}}


def test_profile_required_on_server_and_saved_data_reaches_execution(profile_app):
    client, factory = profile_app
    assert client.get('/api/basic-auth/profile').json()['is_complete'] is False
    assert client.post('/execute').status_code == 428
    assert client.post('/api/basic-auth/profile', json={'institution':'College'}).status_code == 200
    assert client.post('/execute').status_code == 428
    assert client.post('/api/basic-auth/profile', json=DETAILS).status_code == 200
    assert client.get('/api/basic-auth/profile').json()['is_complete'] is True
    assert client.post('/execute').status_code == 200
    with factory() as db:
        data = UserProfileService().get_or_create_profile(db, db.get(User,1))
        assert data.name == DETAILS['name'] and data.institution == DETAILS['institution']
        assert data.course == DETAILS['course'] and data.metadata['roll_number'] == 'IT042'


@pytest.mark.parametrize('payload', [
    {'name':'   '}, {'institution':'  '}, {'course':' '},
    {'profile_metadata':{'year':' '}}, {'profile_metadata':{'roll_number':' '}},
    {'profile_metadata':{'graduation_year':'abc'}}, {'profile_metadata':{'graduation_year':'2101'}},
    {'profile_metadata':{'graduation_year':2028}},
])
def test_blank_or_invalid_profile_fields_rejected(profile_app, payload):
    client, _ = profile_app
    assert client.post('/api/basic-auth/profile', json=payload).status_code == 422
    assert client.post('/execute').status_code == 428


def test_roll_number_is_required_and_profile_cannot_be_faked(profile_app):
    client, factory = profile_app
    partial = {**DETAILS, 'profile_metadata':{'year':'3rd Year','graduation_year':'2028'}}
    assert client.post('/api/basic-auth/profile', json=partial).status_code == 200
    assert client.get('/api/basic-auth/profile').json()['is_complete'] is False
    assert client.post('/execute').status_code == 428
    with factory() as db:
        with pytest.raises(HTTPException) as failure:
            UserProfileService().get_or_create_profile(db, db.get(User,1))
        assert failure.value.status_code == 428
        with pytest.raises(HTTPException) as failure:
            check_execution_access(db.get(User,1))  # Also protects already queued workers.
        assert failure.value.status_code == 428
    fake = SimpleNamespace(name='Student', profile=SimpleNamespace(institution='College',course='Course',
        profile_metadata={**DETAILS['profile_metadata'],'auto_generated':True}))
    assert not profile_is_complete(fake)


def test_existing_owner_exemption_preserved(profile_app, monkeypatch):
    client, _ = profile_app
    monkeypatch.setattr(settings, 'ADMIN_USERID', 'student@example.test')
    monkeypatch.setattr(settings, 'ADMIN_PASSWORD', 'owner-fixture')
    assert client.get('/api/basic-auth/profile').json()['is_complete'] is True
    assert client.post('/execute').status_code == 200
