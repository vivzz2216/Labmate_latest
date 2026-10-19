from unittest.mock import patch

import pytest

from app.services.parser_service import ParserService
from app.services.manual_sections import ManualStructureError, numbered_experiments


@pytest.mark.parametrize('index_heading', ['CONTENTS', 'Table of Contents:', 'INDEX'])
def test_explicit_experiment_entries_in_contents_are_not_duplicate_sections(index_heading):
    text = f'''2 Experiments
{index_heading}
Experiment 1: Portfolio ........ 3
Experiment 2
Records API ........ 4
GENERAL INSTRUCTIONS
Test each application before submission.
EXPERIMENTS
EXPERIMENT 1
Portfolio using HTML and CSS
Aim
Create a responsive portfolio.
Requirements
Include education and contact sections.
EXPERIMENT 2
Records API using Node.js and Express
Requirements
Implement GET and POST endpoints.
Handle missing fields and invalid IDs.'''
    result = numbered_experiments(text)
    assert [row['experiment_number'] for row in result] == [1, 2]
    assert [row['language'] for row in result] == ['html', 'node']
    assert 'contact sections' in result[0]['text']
    assert 'invalid IDs' in result[1]['text']
    assert all('Test each application before submission.' in row['text'] for row in result)
    assert all('........' not in row['text'] for row in result)


def test_contents_without_a_separator_stops_at_real_experiment_requirements():
    text = '''CONTENTS
Experiment 1: Add ........ 2
Experiment 1: Add
Aim
Build a JavaScript calculator.
Requirements
Click Add and display 5 for inputs 2 and 3.'''
    result = numbered_experiments(text)
    assert len(result) == 1
    assert 'Click Add and display 5' in result[0]['text']


def test_real_duplicate_sections_are_still_rejected_after_contents():
    text = '''CONTENTS
Experiment 1: Form ........ 2
EXPERIMENTS
Experiment 1: First form
Requirements
Create a form with email validation.
Experiment 1: Second form
Requirements
Create a separate password form.'''
    with pytest.raises(ManualStructureError, match='same number: 1'):
        numbered_experiments(text)


def test_ambiguous_prose_in_contents_is_not_silently_discarded():
    text = '''CONTENTS
Experiment 1: Calculate
Build a page that displays 5
Experiment 1: Another calculator
Requirements
Build a different calculator.'''
    with pytest.raises(ManualStructureError):
        numbered_experiments(text)


def test_index_inside_actual_exercise_cannot_hide_later_duplicates():
    text = '''Experiment 1: Portfolio
Requirements
Build an HTML portfolio.
Index
Experiment 1: API
Requirements
Build a Node.js API.'''
    with pytest.raises(ManualStructureError):
        numbered_experiments(text)


def test_contents_only_upload_does_not_fabricate_experiments():
    with pytest.raises(ManualStructureError, match='Only contents/index entries'):
        numbered_experiments('CONTENTS\nExperiment 1: Portfolio ........ 3\nExperiment 2: API ........ 4')


def test_declared_count_is_checked_after_excluding_index_entries():
    text = '''2 Experiments
CONTENTS
Experiment 1: Portfolio ........ 3
EXPERIMENTS
Experiment 1: Portfolio
Requirements
Build an HTML portfolio.'''
    with pytest.raises(ManualStructureError, match='2 experiments, but 1'):
        numbered_experiments(text)


def test_framework_titles_win_over_generic_registration_and_form_keywords():
    from app.services.manual_sections import section_language
    assert section_language('Student Registration with Flask','Build a validated web form.')=='python'
    assert section_language('Student Registration Using Java Swing','Build a form.')=='java'
    assert section_language('AWT calculator','Add two integers.')=='java'


def test_pdf_titles_on_the_next_line_preserve_react_and_node_runtimes():
    from app.services.manual_sections import numbered_experiments
    from app.services.web_project import web_requirements
    text='''GENERAL INSTRUCTIONS
Test valid and invalid input cases for interactive applications.
For the Node.js experiment test each endpoint using an API client.
EXPERIMENTS
EXPERIMENT 1
Design a Personal Portfolio Using HTML and CSS
Requirements
Use semantic HTML and responsive navigation.
EXPERIMENT 2
Implement Routing Using React Router
Requirements
Create components for Profile and Courses using JavaScript.
EXPERIMENT 3
Student Records REST API Using Node.js and Express
Requirements
Validate input and test GET and POST endpoints.'''
    result=numbered_experiments(text)
    assert [r['language'] for r in result]==['html','react','node']
    assert result[2]['title'].startswith('Student Records')
    assert 'API client' not in result[0]['text']
    assert 'validation' not in {r['id'] for r in web_requirements(result[0]['text'],'html')}
    assert 'named_components' not in {r['id'] for r in web_requirements(result[1]['text'],'react')}


def test_mixed_manual_preserves_three_experiments_order_languages_and_requirements():
    parser = ParserService()
    lines = [
        'Laboratory manual', 'Experiment 1 C input and output',
        'Write a C program that reads 2 and 3 and prints their sum.', 'Expected output: 5',
        'Experiment 2 Python functions', 'Write a Python program that prints square of 6.',
        'Expected output: 36', 'Experiment 3 Browser modal',
        'Create an HTML JavaScript page with an Open button that opens a dialog.',
        'Save index.html and style.css. Capture the dialog after clicking Open.',
    ]
    with patch.object(parser, '_extract_tasks_with_openai', return_value=None):
        tasks = parser._extract_tasks_from_lines(lines)
    assert [t['detected_language'] for t in tasks] == ['c', 'python', 'html']
    assert [t['experiment_number'] for t in tasks] == [1, 2, 3]
    assert 'Expected output: 5' in tasks[0]['question_text']
    assert 'Capture the dialog' in tasks[2]['question_text']
    assert tasks[2]['required_source_files'] == ['index.html', 'style.css']


def test_gui_objectives_survive_titles_and_viva_sections():
    parser = ParserService()
    lines = ['Experiment 1 Swing calculator', 'Create a Java Swing calculator with an Add button.',
             'Viva questions', 'Explain inheritance.', 'Experiment 2 Tkinter form',
             'Create a Tkinter login application with validation.', 'Experiment 3 Flask form',
             'Build a Flask application with server validation.']
    with patch.object(parser, '_extract_tasks_with_openai', return_value=None):
        tasks = parser._extract_tasks_from_lines(lines)
    assert [t['detected_language'] for t in tasks] == ['java', 'python', 'python']
    assert 'Explain inheritance' not in str(tasks)
