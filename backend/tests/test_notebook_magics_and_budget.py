"""Regression tests for the Deep Learning manual failures: pip magics, manual-code requirements, notebook time budget."""
import ast
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from docx import Document
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models import AssignmentWorkflow, Upload, User
from app.security.generated_code import validate_generated_code
from app.services import assignment_workflow as flow
from app.services import notebook_runtime
from app.services.colab_requirements import missing_required_libraries
from app.services.lab_capture import notebook_cells
from app.services.notebook_magics import neutralize_magics
from conftest import student_profile

NOTE = '  # (IPython magic skipped)'


# ------------------------------------------------------------------ neutralize_magics
def test_pip_magic_is_commented_out_and_line_numbers_stay_put():
    code = '%pip -q install tensorflow scikit-learn\nimport numpy as np\nprint(np.zeros(1))\n'
    result = neutralize_magics(code)
    assert result.splitlines()[0] == '# %pip -q install tensorflow scikit-learn' + NOTE
    assert result.splitlines()[1:] == code.splitlines()[1:]
    ast.parse(result)


@pytest.mark.parametrize('line', ['!pip install keras', '%matplotlib inline', '%load_ext autoreload', '!ls -la /content'])
def test_other_line_magics_are_skipped(line):
    result = neutralize_magics(f'{line}\nprint(1)\n')
    assert result.startswith('# ' + line + NOTE)
    ast.parse(result)


def test_cell_magic_and_indented_magic_keep_the_rest_valid():
    assert ast.parse(neutralize_magics('%%time\nprint(1)\n'))
    result = neutralize_magics('if True:\n    !pip install x\n    print(1)\n')
    assert result.splitlines()[1] == '    # !pip install x' + NOTE
    ast.parse(result)


def test_valid_python_is_never_touched():
    # A leading % operator continuing an expression is not a magic.
    code = 'epoch = 3\nx = (7\n     %epoch)\nprint(x)\n'
    assert neutralize_magics(code) == code
    assert neutralize_magics('print(1)\n') == 'print(1)\n'
    assert neutralize_magics(None) is None


def test_text_inside_a_triple_quoted_string_is_left_alone_and_crlf_is_kept():
    code = 'note = """\n%pip this is only text\n"""\n%pip -q install tensorflow\nprint(note)\n'
    result = neutralize_magics(code)
    assert result.splitlines()[1] == '%pip this is only text'
    assert result.splitlines()[3].startswith('# %pip -q install tensorflow')
    windows = neutralize_magics('%pip install x\r\nprint(1)\r\n')
    assert windows.splitlines(keepends=True)[0].endswith(NOTE + '\r\n')


# ------------------------------------------------------------------ requirements come from prose, not from the manual's code
MANUAL = ('Aim\nDesign a convolutional neural network to recognise handwritten digits.\nProcedure\n'
          'Install/import the packages listed at the beginning of the program.\nProgram\n'
          '%pip -q install tensorflow matplotlib\nimport tensorflow as tf\nfrom tensorflow import keras\n'
          'from tensorflow.keras import layers\nimport matplotlib.pyplot as plt\nimport numpy as np\n'
          'model = keras.Sequential([layers.Input((28, 28, 1))])\n')


def test_manual_program_with_pip_magic_and_unused_imports_is_not_missing_libraries():
    program = ('%pip -q install tensorflow matplotlib\nimport numpy as np\nimport matplotlib.pyplot as plt\n'
               'from tensorflow import keras\nmodel = keras.Sequential()\nprint(model)\n')
    # numpy and matplotlib are imported but never used; the manual's prose never asks for them.
    assert missing_required_libraries(MANUAL, program) == []


def test_a_library_the_prose_asks_for_must_still_be_used():
    question = 'Use NumPy for the array maths.\nimport numpy as np\n'
    assert missing_required_libraries(question, 'import numpy as np\nprint(1)\n') == ['numpy']
    assert missing_required_libraries(question, 'import numpy as np\nprint(np.zeros(1))\n') == []
    # Lower-case prose is still an instruction when it says more than an import statement.
    assert missing_required_libraries('import numpy to build the matrix', 'print(1)\n') == ['numpy']


def test_a_real_syntax_error_is_not_reported_as_every_library_missing():
    assert missing_required_libraries('Use PyTorch and Keras.', 'def broken(:\n    pass\n') == []


def test_notebook_validation_and_cells_accept_pip_magic():
    code = '%pip -q install tensorflow\nimport numpy as np\nprint(np.zeros(1))\n'
    validate_generated_code(code, 'python', capability='notebook')
    with pytest.raises(SyntaxError):
        validate_generated_code(code, 'python')  # outside a notebook a magic is still invalid
    cells = notebook_cells(code)
    assert len(cells) == 1 and cells[0]['code'].startswith('# %pip -q install tensorflow')
    import json
    notebook = json.dumps({'cells': [{'cell_type': 'code', 'source': ['!pip install keras\n', 'print(1)\n']}]})
    assert notebook_cells(notebook)[0]['code'].startswith('# !pip install keras')


# ------------------------------------------------------------------ time budget
def test_kernel_startup_is_not_charged_to_the_cell_limit():
    kernel = notebook_runtime.ColabPythonKernel(timeout_sec=8)
    try:
        result = kernel.execute_cell("print('ready')")
    finally:
        kernel.cleanup()
    # Starting the interpreter can take far longer than the 8 second program limit on a slow machine.
    assert not result.get('error'), result
    assert result['stdout'].strip() == 'ready'


def test_a_kernel_that_never_starts_is_reported_as_such(monkeypatch):
    monkeypatch.setattr(notebook_runtime, 'STARTUP_TIMEOUT_SEC', 0.05)
    kernel = notebook_runtime.ColabPythonKernel(timeout_sec=30)
    try:
        result = kernel.execute_cell("print('never runs')")
    finally:
        kernel.cleanup()
    assert result['error'] == 'Notebook runtime did not start in time.'
    assert result['execTime'] == 'timeout'


def test_the_budget_text_names_the_real_limit():
    text = notebook_runtime.compute_budget_instruction()
    assert f'{notebook_runtime.CELL_TIMEOUT_SEC} seconds' in text
    assert '2,000 training samples' in text and 'recurrent' in text


@pytest.mark.asyncio
async def test_repair_after_a_timeout_is_told_the_budget_and_to_cut_the_workload(monkeypatch):
    from app.services.analysis_service import repair_generated_code
    from app.services.generation_service import generation_service
    generate = AsyncMock(return_value={'code': 'print(2)\n'})
    monkeypatch.setattr(generation_service, 'generate_json', generate)
    await repair_generated_code('Train an LSTM using Keras.', 'colab', 'print(1)\n', 'Notebook execution exceeded its time limit.')
    prompt = generate.await_args.args[0]
    assert 'COMPUTE BUDGET' in prompt and 'a quarter of the previous size or less' in prompt
    generate.reset_mock()
    await repair_generated_code('Train an LSTM using Keras.', 'colab', 'print(1)\n', 'NameError: name x is not defined')
    assert 'COMPUTE BUDGET' not in generate.await_args.args[0]


# ------------------------------------------------------------------ the whole workflow
@pytest.mark.asyncio
async def test_workflow_completes_for_a_manual_program_with_pip_magic_and_unused_imports(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path / 'screenshots'))
    monkeypatch.setattr(settings, 'REPORT_DIR', str(tmp_path / 'reports'))
    monkeypatch.setattr(settings, 'BILLING_ENABLED', False)
    monkeypatch.setattr(settings, 'EXECUTION_ALLOWED_EMAILS', 'magic@example.com')
    source = tmp_path / 'manual.docx'
    document = Document(); document.add_paragraph('Deep learning manual'); document.save(source)
    engine = create_engine('sqlite:///' + (tmp_path / 'state.db').as_posix(), connect_args={'check_same_thread': False})
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as db:
        user = User(email='magic@example.com', name='Magic Student', profile=student_profile())
        db.add(user); db.flush()
        upload = Upload(user_id=user.id, filename=source.name, original_filename=source.name, file_path=str(source),
                        file_type='docx', file_size=source.stat().st_size)
        db.add(upload); db.flush()
        workflow = AssignmentWorkflow(upload_id=upload.id, status='processing', stage='generate', mode='code_only', language='colab',
                                      questions=[{'id': 1, 'language': 'colab', 'text': MANUAL}], results=[], output_name='magic')
        db.add(workflow); db.commit(); workflow_id = workflow.id
    program = ('%pip -q install tensorflow matplotlib\nimport numpy as np\nimport matplotlib.pyplot as plt\n'
               'values = [1, 2, 3]\nprint("mean:", sum(values) / len(values))\n')
    monkeypatch.setattr(flow, 'SessionLocal', factory)
    monkeypatch.setattr(flow.generation_service, 'generate_json', AsyncMock(return_value={
        'language': 'colab', 'answer': 'Computes a mean.', 'code': program, 'stdin': '', 'browser_tests': []}))
    await flow.process_assignment(workflow_id)
    with factory() as db:
        saved = db.get(AssignmentWorkflow, workflow_id)
        result = saved.results[0]
        assert saved.status == 'completed', (saved.error, result.get('error'))
        assert result['verification']['kind'] == 'notebook' and result['verification']['status'] == 'passed'
        assert result['code'].startswith('# %pip -q install tensorflow matplotlib')
        assert 'mean: 2.0' in result['output']
        assert len(result['screenshot_paths']) >= 1
    engine.dispose()
