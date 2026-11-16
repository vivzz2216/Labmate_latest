"""A lab manual with Theory and Viva-Voce sections around its program must be accepted by POST /process.

Both the web page and the workflow queue send the whole extracted experiment, so the filter must judge the part a
student programs, not the manual's headings. Production rejected every Deep Learning manual with "Only valid
laboratory questions can be processed" because of the "Viva-Voce Questions" heading (and "handwritten digit").
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.middleware.auth import get_current_user
from app.middleware.csrf import require_csrf_token
from app.models import AssignmentWorkflow, Upload, User
from app.routers import workflows
from app.services.lab_question_filter import filter_lab_tasks, is_actionable_lab_question, practical_text
from conftest import student_profile

MANUAL = """Experiment 9: CNN for Handwritten Digit Recognition
University of Mumbai | B.E. Computer Engineering | Semester VIII
Environment: Google Colab or Jupyter Notebook | Language: Python 3
1. Aim
Design and implement a convolutional neural network to recognize handwritten digits from the MNIST dataset.
2. Learning Objectives
Understand the model, implement it in Python, execute the experiment, inspect the output and interpret the result.
3. Theory
CNNs learn spatial features using convolution filters. Pooling reduces spatial dimensions.
5. Procedure
1. Open Google Colab or Jupyter Notebook and create a new Python notebook.
6. Program
import tensorflow as tf
from tensorflow import keras
model = keras.Sequential([keras.layers.Input((28, 28, 1))])
print("Test accuracy:", 1.0)
7. Expected Output / Observation
The program prints the CNN architecture and test accuracy.
8. Result
A CNN was trained and evaluated for handwritten digit recognition using MNIST.
9. Viva-Voce Questions
1. What does a convolution filter learn?
2. What is the purpose of max pooling?
10. Submission Checklist
Attach code, successful execution output and answers to viva questions.
"""


def test_the_programming_part_is_judged_not_the_manual_headings():
    assert 'Viva-Voce' not in practical_text(MANUAL)
    assert 'Theory' not in practical_text(MANUAL)
    assert 'print("Test accuracy:", 1.0)' in practical_text(MANUAL)
    assert is_actionable_lab_question(MANUAL, 'colab')
    kept = filter_lab_tasks([{'id': 1, 'text': MANUAL, 'language': 'colab'}], mode='code_only')
    assert len(kept) == 1 and kept[0]['text'] == MANUAL  # the original text is never rewritten


@pytest.mark.parametrize('text', [
    'Explain the viva questions on convolutional networks.',
    'Theory\nExplain pooling.\nViva-Voce Questions\n1. What is pooling?',
    'Write the answers by hand in your record book.',
    'Draw by hand the architecture of a CNN.',
])
def test_theory_and_handwritten_tasks_are_still_rejected(text):
    assert not is_actionable_lab_question(text, 'colab')


@pytest.fixture
def client(tmp_path):
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email='route@example.com', name='Route Student', profile=student_profile())
        db.add(user); db.flush()
        upload = Upload(user_id=user.id, filename='manual.pdf', original_filename='manual.pdf', file_path='unused',
                        file_type='pdf', file_size=1)
        db.add(upload); db.flush()
        db.add(AssignmentWorkflow(upload_id=upload.id, status='ready', stage='review', progress=20, language='auto',
                                  questions=[{'id': 1, 'text': MANUAL, 'language': 'colab'}], results=[], output_name='manual'))
        db.commit()
        ids = (user.id, upload.id)
    app = FastAPI()
    app.include_router(workflows.router, prefix='/api')

    def session():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = session
    app.dependency_overrides[get_current_user] = lambda: User(id=ids[0], email='route@example.com', name='Route Student',
                                                              is_active=True, profile=student_profile())
    app.dependency_overrides[require_csrf_token] = lambda: True
    with TestClient(app) as test_client:
        test_client.upload_id = ids[1]
        yield test_client
    engine.dispose()


def test_process_accepts_a_manual_with_viva_and_handwritten_digit_text(client):
    payload = {'questions': [{'id': 1, 'text': MANUAL, 'language': 'colab', 'colab_theme': 'dark'}], 'language': 'colab',
               'instructions': '', 'output_name': 'manual', 'screenshot_style': 'style_1', 'mode': 'code_only'}
    response = client.post(f'/api/workflows/{client.upload_id}/process', json=payload)
    assert response.status_code == 200, response.text
    assert response.json()['status'] == 'queued'
