"""Regression texts extracted from the two student-supplied Experiment 6 PDFs."""
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.background import BackgroundTasks
from starlette.requests import Request

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.routers import workflows
from app.services import assignment_workflow as flow
from app.services.lab_question_filter import filter_lab_tasks, programming_lines
from app.services.manual_sections import numbered_experiments, section_language


FIXTURES = Path(__file__).parent / 'fixtures' / 'academic_exp6'
CASES = [('sql_exp6.txt', 'sql'), ('ds_exp6.txt', 'colab')]


@pytest.mark.parametrize('filename,language', CASES)
def test_practical_requirements_survive_unrelated_handwritten_theory(filename, language):
    tasks = numbered_experiments((FIXTURES / filename).read_text(encoding='utf-8'))
    assert len(tasks) == 1
    question = tasks[0]
    assert question['id'] == 6 and question['language'] == language
    assert len(filter_lab_tasks(tasks)) == 1, 'The process endpoint must accept extracted tasks.'
    text = question['text']
    if language == 'sql':
        for requirement in ('8 to 10 records', 'For Joins (Any three)', 'VIEWS(Give two examples)',
                            'CREATE VIEW product_data', 'Attach all queries executed code'):
            assert requirement in text
        assert 'Explain what are Joins' not in text
        assert 'To be hand written' not in text
    else:
        for requirement in ('home_loan_train.csv', 'GaussianNB', 'train_test_split',
                            'accuracy_score', 'Compare same dataset with other classifiers SVM and KNN',
                            'Paste Screenshots', 'https://www.kaggle.com/'):
            assert requirement in text
        assert 'Handwritten digit recognition' not in text
        assert 'Binary Classification' not in text


def test_standalone_handwritten_experiment_is_still_excluded():
    assert numbered_experiments('Experiment 6: Handwritten exercise\nAim: Write code by hand.\n'
                                'Laboratory Exercise\nA. Procedure:\nWrite a Python program.') == []


def test_normal_procedure_is_excluded_but_lab_procedure_is_executable():
    source = ['Experiment 6: SQL joins', 'Objective:', 'Explain joins.', 'Laboratory Exercise',
              'A. Procedure:', 'CREATE TABLE t(v INT);', 'B. Conclusion:', 'Explain the result.']
    practical = programming_lines(source)
    assert 'CREATE TABLE t(v INT);' in practical
    assert 'Explain joins.' not in practical and 'Explain the result.' not in practical
    assert 'Open your IDE.' not in programming_lines(['Procedure:', 'Open your IDE.'])


def test_explicit_web_language_still_wins_over_embedded_sql():
    assert section_language('React database viewer', 'Display CREATE TABLE t(v INT);') == 'react'
    assert section_language('Node.js SQL API', 'CREATE TABLE t(v INT);') == 'node'


@pytest.mark.asyncio
@pytest.mark.parametrize('filename,language', CASES)
async def test_extract_and_submit_academic_experiment_without_an_ai_call(tmp_path, monkeypatch, filename, language):
    engine = create_engine('sqlite:///' + (tmp_path / 'state.db').as_posix())
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    monkeypatch.setattr(flow, 'SessionLocal', factory)
    monkeypatch.setattr(flow, 'document_text', lambda upload: (FIXTURES / filename).read_text(encoding='utf-8'))
    generate = AsyncMock(side_effect=AssertionError('Numbered extraction must not call a model.'))
    monkeypatch.setattr(flow.generation_service, 'generate_json', generate)
    monkeypatch.setattr(settings, 'BILLING_ENABLED', False)
    try:
        with factory() as db:
            user = User(email='extraction@example.com', name='Extraction Test')
            db.add(user); db.flush()
            upload = Upload(user_id=user.id, filename=filename, original_filename=filename,
                            file_path='fixture', file_type='pdf', file_size=100)
            db.add(upload); db.flush()
            workflow = AssignmentWorkflow(upload_id=upload.id, status='extracting', mode='code_only')
            db.add(workflow); db.commit()
            wid, uid, user_id = workflow.id, upload.id, user.id
        await flow.extract_assignment(wid)
        with factory() as db:
            workflow = db.get(AssignmentWorkflow, wid)
            assert workflow.status == 'ready', workflow.error
            assert workflow.error is None
            assert [(q['id'], q['language']) for q in workflow.questions] == [(6, language)]
            data = workflows.ProcessInput(questions=[workflows.QuestionInput(
                id=q['id'], text=q['text'], language=q['language']) for q in workflow.questions])
            request = Request({'type': 'http', 'method': 'POST', 'path': '/', 'headers': []})
            response = await workflows.process(uid, data, request, BackgroundTasks(),
                                               user=db.get(User, user_id), db=db, csrf=True)
            assert response['status'] == 'queued'
            assert response['questions'][0]['language'] == language
        generate.assert_not_awaited()
    finally:
        engine.dispose()
