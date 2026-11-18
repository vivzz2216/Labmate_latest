"""The signed-in student's full name must reach real C output and the report."""

from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from docx import Document
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, Report, Upload, User
from app.services import assignment_workflow as flow
from conftest import student_profile


@pytest.mark.asyncio
async def test_c_manual_repairs_foreign_sample_name_before_report(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path / 'screenshots'))
    monkeypatch.setattr(settings, 'REPORT_DIR', str(tmp_path / 'reports'))
    monkeypatch.setattr(settings, 'BILLING_ENABLED', False)
    monkeypatch.setattr(settings, 'EXECUTION_ALLOWED_EMAILS', 'student@example.test')
    monkeypatch.setattr(settings, 'LLM_PROVIDER', 'glm')

    manual = tmp_path / 'C_Manual_01.docx'
    original = Document()
    original.add_paragraph('Functions and Student Marks')
    original.add_paragraph('Use marks out of 100 and the student name on the report.')
    original.add_paragraph('Question 1: Array statistics. Print the original marks and sum 400.')
    original.save(manual)

    database = create_engine('sqlite:///' + (tmp_path / 'state.db').as_posix(),
                             connect_args={'check_same_thread': False})
    Base.metadata.create_all(database)
    sessions = sessionmaker(bind=database)
    with sessions() as db:
        user = User(email='student@example.test', name='sheru bhai', profile=student_profile())
        db.add(user)
        db.flush()
        upload = Upload(user_id=user.id, filename=manual.name,
                        original_filename=manual.name, file_path=str(manual),
                        file_type='docx', file_size=manual.stat().st_size)
        db.add(upload)
        db.flush()
        workflow = AssignmentWorkflow(upload_id=upload.id, status='processing', stage='generate',
                                      mode='code_only', language='auto',
                                      questions=[{'id': 1, 'language': 'c', 'text':
                                                  'Question 1: Array statistics. Print the student name and sum 400.'}],
                                      results=[], output_name='c_profile_regression')
        db.add(workflow)
        db.commit()
        workflow_id = workflow.id

    first_code = '''/* Student Name: sheru bhai */
#include <stdio.h>
int main(void) { char name[80]; printf("Enter student name: ");
  scanf("%79s", name); printf("Student Name: %s\\nSum: 400\\n", name); return 0; }
'''
    repaired_code = '''/* Student Name: sheru bhai */
#include <stdio.h>
#include <string.h>
int main(void) { char name[80]; printf("Enter student name: ");
  fgets(name, sizeof name, stdin); name[strcspn(name, "\\n")] = 0;
  printf("Student Name: %s\\nSum: 400\\n", name); return 0; }
'''
    monkeypatch.setattr(flow, 'SessionLocal', sessions)
    monkeypatch.setattr(flow.generation_service, 'generate_json', AsyncMock(return_value={
        'language': 'c', 'answer': 'Used an array and printed the result.',
        'code': first_code, 'stdin': 'Ravi\n', 'browser_tests': [],
    }))
    repair = AsyncMock(return_value=repaired_code)
    monkeypatch.setattr(flow, 'repair_generated_code', repair)

    await flow.process_assignment(workflow_id)

    with sessions() as db:
        workflow = db.get(AssignmentWorkflow, workflow_id)
        assert workflow.status == 'completed', (workflow.error, workflow.results)
        result = workflow.results[0]
        assert result['status'] == 'completed'
        assert 'Student Name: sheru bhai' in result['output']
        assert 'Student Name: Ravi' not in result['output']
        assert len(result['screenshot_paths']) >= 2
        assert repair.await_count >= 1
        assert 'sheru bhai' in repair.await_args.args[0]
        report = db.get(Report, workflow.report_id)
        assert Path(report.file_path).is_file()
        assert len(Document(report.file_path).inline_shapes) >= 2
    database.dispose()
