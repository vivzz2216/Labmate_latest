"""Exercise the assignment capture entry points, rather than only isolated templates."""
from unittest.mock import patch

import pytest

from app.config import settings
from app.services.browser_capture import acquire_capture_context
from app.services.screenshot_service import screenshot_service
from app.services.source_evidence import capture_source_evidence


@pytest.mark.asyncio
@pytest.mark.parametrize('language,theme,filename,code,selector,label',[
    ('python','idle','inheritance.py','\nclass Employee:\n    pass\n\nprint("LAST_LINE")\n','.idle-text','Python'),
    ('java','notepad','Main.java','class Main {\n  // LAST_LINE\n}\n','.notepad-body','Main.java - Notepad'),
    ('java_gui','notepad','Window.java','class Window {\n  // LAST_LINE\n}\n','.notepad-body','Window.java - Notepad'),
    ('c','codeblocks','solution.c','#include <stdio.h>\nint main(void) {\n  puts("LAST_LINE");\n}\n','.cb-code-content','solution.c - Code::Blocks'),
    ('cpp','codeblocks','solution.cpp','#include <iostream>\nint main() {\n  std::cout << "LAST_LINE";\n}\n','.cb-code-content','solution.cpp - Code::Blocks'),
    ('html','vscode','index.html','<main>LAST_LINE</main>\n','.line-code','Visual Studio Code'),
    ('react','vscode','App.jsx','export default function App(){return <main>LAST_LINE</main>;}\n','.line-code','Visual Studio Code'),
    ('node','vscode','solution.cjs','console.log("LAST_LINE");\n','.line-code','Visual Studio Code'),
])
async def test_assignment_source_uses_language_ui(tmp_path,monkeypatch,language,theme,filename,code,selector,label):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    original=screenshot_service._take_screenshot
    async def inspect(html,path,**kwargs):
        assert label in html
        async with acquire_capture_context(java_script_enabled=False) as context:
            page=await context.new_page()
            await page.set_content(html)
            text='\n'.join(await page.locator(selector).all_text_contents())
            assert text.rstrip()==code.rstrip()
            assert await page.locator('header').count()==0  # generic evidence sheet
        return await original(html,path,**kwargs)
    with patch.object(screenshot_service,'_take_screenshot',side_effect=inspect):
        images,errors=await capture_source_evidence(None,code,filename,theme=theme,group='theme-check',
            username='Student',language=language,screenshot_style='style_1')
    assert not errors and len(images)==1


@pytest.mark.asyncio
@pytest.mark.parametrize('language,theme,filename,selector,label',[
    ('python','idle','sum.py','.shell-stdout','Python 3.11.4 Shell'),
    ('java','notepad','Main.java','.cmd-body','Command Prompt'),
    ('c','codeblocks','solution.c','.cb-console-body','Captured program output'),
    ('cpp','codeblocks','solution.cpp','.cb-console-body','Captured program output'),
])
async def test_console_output_keeps_only_shell_and_exact_transcript(tmp_path,monkeypatch,language,theme,filename,selector,label):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    original=screenshot_service._take_screenshot
    transcript='First: 2\nSecond: 3\nSum: 5\n'
    async def inspect(html,path,**kwargs):
        assert label in html
        async with acquire_capture_context(java_script_enabled=False) as context:
            page=await context.new_page();await page.set_content(html)
            assert await page.locator('.editor-window,.notepad-body').count()==0
            assert transcript.rstrip() in await page.locator(selector).inner_text()
        return await original(html,path,**kwargs)
    with patch.object(screenshot_service,'_take_screenshot',side_effect=inspect):
        ok,path,_,_=await screenshot_service.generate_screenshot('print(5)' if language=='python' else 'class Main {}',
            transcript,theme,'output-check','Student',filename,view_mode='output',presentation='ide_evidence',
            language=language,input_echoed=True)
    assert ok,path


@pytest.mark.asyncio
async def test_complete_idle_source_pages_show_only_their_real_lines(tmp_path,monkeypatch):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    code='\n'.join(f'value_{i} = {i}' for i in range(1,71))+'\n'
    original=screenshot_service._take_screenshot
    observed=[]
    async def inspect(html,path,**kwargs):
        async with acquire_capture_context(java_script_enabled=False) as context:
            page=await context.new_page();await page.set_content(html)
            observed.extend((await page.locator('.idle-text').inner_text()).splitlines())
        return await original(html,path,**kwargs)
    with patch.object(screenshot_service,'_take_screenshot',side_effect=inspect):
        images,errors=await capture_source_evidence(None,code,'long.py',theme='idle',group='pages',username='Student',
            language='python',screenshot_style='style_1',policy='complete')
    assert not errors and len(images)==3
    assert observed==code.splitlines()


@pytest.mark.asyncio
@pytest.mark.parametrize('language,filename', [('c','solution.c'), ('cpp','solution.cpp')])
async def test_windows_console_preserves_real_transcript_without_invented_status(tmp_path,monkeypatch,language,filename):
    monkeypatch.setattr(settings,'SCREENSHOT_DIR',str(tmp_path))
    transcript='First line\n    indented result\nLast line\n'
    original=screenshot_service._take_screenshot
    async def inspect(html,path,**kwargs):
        async with acquire_capture_context(java_script_enabled=False) as context:
            page=await context.new_page();await page.set_content(html)
            assert await page.locator('.cb-console-output').text_content() == transcript
            assert await page.locator('.cb-console-titlebar .cb-win-btn').count() == 3
            assert await page.locator('.cb-console-tab').count() == 1
            assert 'Formatted transcript' not in await page.locator('.cb-console-body').inner_text()
            assert 'Process returned' not in await page.locator('.cb-console-body').inner_text()
        return await original(html,path,**kwargs)
    with patch.object(screenshot_service,'_take_screenshot',side_effect=inspect):
        ok,path,_,_=await screenshot_service.generate_screenshot('int main() {}',transcript,'codeblocks',
            'windows-console','Student',filename,view_mode='output',presentation='ide_evidence',language=language)
    assert ok,path


@pytest.mark.asyncio
async def test_browser_preview_has_windows_controls():
    html=await screenshot_service._render_template('', 'Example', 'browser_preview', filename='index.html')
    async with acquire_capture_context(java_script_enabled=False) as context:
        page=await context.new_page();await page.set_content(html)
        assert await page.locator('.chrome-controls .chrome-control').count()==3
        assert await page.locator('.chrome-dots').count()==0
