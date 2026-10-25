import unittest
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.services.assignment_workflow import extract_assignment
from app.services.lab_question_filter import programming_lines
from app.services.manual_sections import ManualStructureError, numbered_experiments


MANUAL = '''Department of Information Technology
Experiment - 9: IPL Mini Project
1. Aim: To design a webapp on a topic selected for mini-project using HTML, CSS, JavaScript and React.
2. Objective: After performing the experiment,
Students will understand the basic concepts of React.
3. Lab Outcome:
Students will build front end applications.
6. Pre-Experiment Theory:
Theory of all previous experiments 1 to 8 is applicable.
7. Laboratory Exercise:
A. Procedure-
Discussion and selection of a topic in consultation with faculty.
B. Program Code
Write and execute required code to design a webapp on a topic selected from the following suggestive list for the mini-project.
Restaurant
Any Tourist location
Music Store
Lifestyle Brand
A self-paced learning course
Any product (eg. Wonderchef/ Tupperware)
Personal webpage
Any event/conference webpage
8. Post Experimental Exercise-
Demonstrate the project in class.
'''


class AcademicManualTests(unittest.TestCase):
    def test_hyphenated_experiment_preserves_one_react_task_and_topic_choices(self):
        for heading in ['Experiment - 9', 'Experiment-9', 'Experiment – 9', 'Experiment — 9', 'Experiment 9']:
            with self.subTest(heading=heading):
                tasks = numbered_experiments(MANUAL.replace('Experiment - 9', heading))
                self.assertEqual(len(tasks), 1)
                self.assertEqual(tasks[0]['id'], 9)
                self.assertEqual(tasks[0]['language'], 'react')
                self.assertIn('Write and execute required code', tasks[0]['text'])
                self.assertIn('React', tasks[0]['text'])
                self.assertIn('Restaurant', tasks[0]['text'])
                self.assertIn('Any event/conference webpage', tasks[0]['text'])

    def test_numbered_laboratory_and_program_headings_end_theory_exclusion(self):
        for start in ['7. Laboratory Exercise:', '7) Laboratory Exercise:', 'B. Program Code']:
            text = '2. Objective:\nExplain React concepts.\n'+start+'\nWrite a React webapp with a form.'
            filtered = '\n'.join(programming_lines(text.splitlines()))
            self.assertNotIn('Explain React', filtered)
            self.assertIn('Write a React webapp with a form.', filtered)
            self.assertIn(start, filtered)

    def test_numbered_theory_questions_remain_excluded(self):
        filtered = '\n'.join(programming_lines('2. Theory:\n1. Write a program to discuss concepts.\nB. Program Code\nBuild a React application.'.splitlines()))
        self.assertNotIn('discuss concepts', filtered)
        self.assertIn('Build a React application.', filtered)

    def test_duplicate_experiment_numbers_still_fail_instead_of_losing_tasks(self):
        with self.assertRaises(ManualStructureError):
            numbered_experiments(MANUAL+'\nExperiment - 9: Another project\nBuild a React app.')


class AcademicWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_extraction_boundary_needs_no_model_or_fallback_for_numbered_manual(self):
        with TemporaryDirectory() as folder:
            engine = create_engine('sqlite:///'+folder.replace('\\','/')+'/test.db',connect_args={'check_same_thread':False})
            Base.metadata.create_all(engine)
            factory = sessionmaker(bind=engine)
            with factory() as db:
                user = User(email='manual@example.com',name='Manual Test')
                db.add(user); db.flush()
                upload = Upload(user_id=user.id,filename='exp9.docx',original_filename='EXP-9_IP_202425.docx',file_path='test-fixture',file_type='docx',file_size=100)
                db.add(upload); db.flush()
                workflow = AssignmentWorkflow(upload_id=upload.id,status='extracting',mode='code_only')
                db.add(workflow); db.commit(); workflow_id = workflow.id
            try:
                with patch('app.services.assignment_workflow.SessionLocal',factory), \
                     patch('app.services.assignment_workflow.document_text',return_value=MANUAL), \
                     patch('app.services.assignment_workflow.generation_service.generate_json',AsyncMock(side_effect=AssertionError('Model should not be called'))) as generate:
                    await extract_assignment(workflow_id)
                with factory() as db:
                    result = db.get(AssignmentWorkflow,workflow_id)
                    self.assertEqual(result.status,'ready',result.error)
                    self.assertIsNone(result.error)
                    self.assertEqual(result.questions[0]['id'],9)
                    self.assertEqual(result.questions[0]['language'],'react')
                    self.assertEqual(len(result.questions),1)
                generate.assert_not_awaited()
            finally:
                engine.dispose()
