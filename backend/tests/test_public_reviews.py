import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import StudentFeedback, User
from app.routers.feedback import router


@pytest.fixture
def reviews():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)
    with session() as db:
        user = User(name='Private Student', email='private@example.org', password_hash='not-a-real-password')
        db.add(user); db.flush()
        for rating, message in [(5, 'Useful for my lab.'), (3, 'Please improve the screenshots.'),
                                (None, 'Private support request.'), (4, 'Private Student: mail private@example.org or call +91 98765 43210')]:
            db.add(StudentFeedback(user_id=user.id, rating=rating, message=message))
        db.commit()
    app = FastAPI(); app.include_router(router, prefix='/api')
    def database():
        with session() as db:
            yield db
    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        yield client, session
    engine.dispose()


def test_only_rated_feedback_is_public_and_anonymous(reviews):
    client, _ = reviews
    response = client.get('/api/feedback/reviews')
    assert response.status_code == 200
    data = response.json()
    assert data['total'] == 3 and data['average_rating'] == 4.0
    assert len(data['reviews']) == 3
    for private in ('private@example.org', 'Private Student', '98765', 'Private support request', 'password_hash', 'user_id'):
        assert private not in response.text
    assert '[email removed]' in response.text and '[phone removed]' in response.text
    assert response.headers['cache-control'] == 'public, max-age=60'


def test_reviews_are_paginated_and_parameters_are_bounded(reviews):
    client, _ = reviews
    first = client.get('/api/feedback/reviews?limit=1').json()
    next_page = client.get('/api/feedback/reviews?limit=1&offset=1').json()
    assert first['total'] == next_page['total'] == 3
    assert first['reviews'][0]['id'] != next_page['reviews'][0]['id']
    assert client.get('/api/feedback/reviews?limit=1000').status_code == 422
    assert client.get('/api/feedback/reviews?offset=-1').status_code == 422


def test_no_reviews_has_no_invented_rating(reviews):
    client, session = reviews
    with session() as db:
        db.query(StudentFeedback).delete(); db.commit()
    assert client.get('/api/feedback/reviews').json() == {'total': 0, 'average_rating': None, 'reviews': []}


def test_anonymous_visitors_cannot_submit_feedback(reviews):
    client, _ = reviews
    assert client.post('/api/feedback', json={'rating': 5, 'message': 'Unauthorized'}).status_code in (401, 403)
