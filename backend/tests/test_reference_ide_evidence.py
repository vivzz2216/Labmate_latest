import pytest

from app.services.screenshot_service import screenshot_service


@pytest.mark.asyncio
async def test_idle_reference_preserves_source_and_captured_output():
    code = 'print("hello")'
    highlighted = screenshot_service._highlight_code(code, 'idle')
    editor = await screenshot_service._render_template(highlighted, '', 'idle', filename='hello.py', username='Student', source_code=code, view_mode='editor', presentation='ide_evidence')
    shell = await screenshot_service._render_template(highlighted, 'hello\n', 'idle', filename='hello.py', username='Student', source_code=code, view_mode='shell', presentation='ide_evidence', input_echoed=True)
    assert 'File</span><span>Edit</span><span>Format' in editor
    assert 'C:/Users/Student/Documents/hello.py' in editor
    assert 'IDLE Shell' in shell and 'shell-stdout">hello' in shell
    assert 'win32' not in shell and '3.14.8' not in shell


@pytest.mark.asyncio
async def test_java_commands_are_safe_and_stdout_is_escaped():
    html = await screenshot_service._render_template('', '<result>\n', 'notepad', filename='Main.java', username='../A B', source_code='class Main {}', view_mode='output', presentation='ide_evidence', language='java', input_echoed=True)
    assert 'C:\\Users\\A_B\\Documents&gt;javac Main.java' in html
    assert 'C:\\Users\\A_B\\Documents&gt;java Main' in html
    assert '&lt;result&gt;' in html
    assert '../A B' not in html


@pytest.mark.asyncio
async def test_cpp_does_not_show_java_commands():
    html = await screenshot_service._render_template('', '3\n', 'codeblocks', filename='solution.cpp', source_code='int main() {}', view_mode='output', presentation='ide_evidence', language='cpp', input_echoed=True)
    assert 'Command Prompt' in html and '3</div>' in html
    assert 'javac' not in html
