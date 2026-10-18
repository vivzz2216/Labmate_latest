import hashlib
from pathlib import Path
from unittest.mock import AsyncMock,patch

import pytest
from PIL import Image
from playwright.async_api import async_playwright

from app.services.browser_capture import launch_capture_browser
from app.services.screenshot_service import screenshot_service
from app.services.source_evidence import capture_source_evidence,source_files,source_capture_plan,excerpt_ranges
from app.services.evidence_planner import select_evidence


@pytest.mark.asyncio
async def test_dark_modern_uses_actual_logo_fonts_and_jsx_tokens_without_source_changes():
    from app.services._vendor.pygments_jsx import JsxLexer
    from pygments import lex
    from pygments.token import Error
    source="import React from 'react';\nexport default function App(){return <main><h1>Result</h1></main>;}\n"
    tokens=list(lex(source,JsxLexer(stripnl=False,ensurenl=False)))
    assert ''.join(value for _,value in tokens)==source
    assert not any(token is Error for token,_ in tokens)
    html=await screenshot_service._render_template('','','vscode',filename='src/App.jsx',source_code=source,presentation='vscode_evidence',language='react')
    assert 'alt="Visual Studio Code"' in html and 'data:image/png;base64,' in html
    assert 'font-family:codicon' in html and 'font-family:seti' in html
    assert 'grid-template-columns:52px minmax(0,1fr)' in html


def test_console_source_labels_match_actual_runtime_filenames():
    assert source_files(None,'class Main { public static void main(String[] args) {} }','Wrong.java','java')[0][0]=='Main.java'
    assert source_files(None,'int main(){return 0;}','arbitrary.c','c')[0][0]=='solution.c'
    assert source_files(None,'#include <iostream>\nint main(){}','arbitrary.cpp','cpp')[0][0]=='solution.cpp'
    assert source_files(None,'console.log(5)','arbitrary.js','node')[0][0]=='solution.cjs'


@pytest.mark.asyncio
async def test_each_project_source_is_captured_with_exact_filename_and_content(tmp_path):
    files={'index.html':'<main>Hello</main>','src/main.jsx':'mount();','src/App.jsx':'export default function App(){return <main>Hello</main>}',
           'src/styles.css':'main { color:red; }','server.cjs':'require("express")();','logo.svg':'<svg xmlns="http://www.w3.org/2000/svg"/>',
           'README.md':'Run npm install then npx vite.'}
    async def capture(code,output,theme,group,username,filename,**kw):
        assert code==files[filename] and output=='' and kw['view_mode']=='editor'
        # Filenames are visibly distinct in real previews; use distinct fixture pixels too.
        path=tmp_path/(filename.replace('/','_')+'.png')
        Image.new('RGB',(960,200),(len(code),len(filename),20)).save(path)
        return True,str(path),960,200
    mock=AsyncMock(side_effect=capture)
    with patch('app.services.source_evidence.screenshot_service.generate_screenshot',mock):
        sources,errors=await capture_source_evidence(files,'mount();','wrong.jsx',theme='vscode',group='test',username='Student',language='react',screenshot_style='style_1')
    assert not errors
    assert {s['source_file'] for s in sources}=={'src/App.jsx','server.cjs'}
    assert mock.await_count==2
    for s in sources:assert s['source_sha256']==hashlib.sha256(files[s['source_file']].encode()).hexdigest()
    selection=select_evidence({'requirements':[],'required_source_files':['src/App.jsx','server.cjs']},sources)
    assert not selection['missing_requirements']


def test_ai_selection_uses_real_functional_files_and_omits_react_css():
    files={'src/main.jsx':"createRoot(root).render(<App/>);",'src/App.jsx':'function App(){return <main/>}', 'src/styles.css':'main{}'}
    plan=source_capture_plan(files,'','src/main.jsx','react',['src/styles.css','src/main.jsx'])
    assert [n for n,_ in plan['files']]==['src/App.jsx']
    assert 'src/styles.css' in plan['omitted']
    with pytest.raises(ValueError,match='actual source files'):source_capture_plan(files,'','','react',['missing.jsx'])
    assert excerpt_ranges('\n'.join('line '+str(i) for i in range(100)))==[[1,20],[81,100]]


@pytest.mark.asyncio
async def test_vscode_frame_excerpts_keep_original_numbers_and_disclose_omissions(tmp_path):
    code='\n'.join('const value'+str(i)+' = '+str(i)+';' for i in range(1,101))
    html=await screenshot_service._render_template('','','vscode',filename='src/App.jsx',source_code=code,presentation='vscode_evidence',view_mode='editor',source_ranges=[[1,20],[81,100]])
    async with async_playwright() as pw:
        browser=await launch_capture_browser(pw)
        try:
            page=await browser.new_page(java_script_enabled=False,viewport={'width':1128,'height':300})
            await page.route('**/*',lambda r:r.abort());await page.set_content(html)
            assert await page.locator('.titlebar').count()==1 and await page.locator('.sidebar').count()==1
            assert await page.locator('.number').all_text_contents()==[str(i) for i in [*range(1,21),*range(81,101)]]
            assert 'lines 21–80 omitted' in await page.locator('.omission').inner_text()
            assert 'const value50' not in await page.locator('pre').inner_text()
            assert not await page.evaluate('document.documentElement.scrollWidth > innerWidth')
        finally:await browser.close()
    with patch('app.services.screenshot_service.settings.SCREENSHOT_DIR',str(tmp_path)):
        captures,errors=await capture_source_evidence({'src/App.jsx':code,'src/styles.css':'body{}'},code,'src/App.jsx',theme='vscode',group='excerpts',username='Student',language='react',screenshot_style='style_1',requested_files=['src/App.jsx'])
    assert not errors and len(captures)==1 and captures[0]['omitted_line_count']==60
    with Image.open(captures[0]['path']) as im:assert im.width==1128 and im.height<1800


@pytest.mark.asyncio
async def test_failed_file_capture_cannot_be_satisfied_by_other_source_images(tmp_path):
    path=tmp_path/'one.png';Image.new('RGB',(960,200),'white').save(path)
    with patch('app.services.source_evidence.screenshot_service.generate_screenshot',AsyncMock(side_effect=[(True,str(path),960,200),(False,'',0,0)])):
        sources,errors=await capture_source_evidence({'index.html':'<main/>','styles.css':'main{}'},'','',theme='vscode',group='test',username='Student',language='html',screenshot_style='style_1')
    assert errors==['Source screenshot could not be captured completely: styles.css']
    selection=select_evidence({'requirements':[],'required_source_files':['index.html','styles.css']},sources)
    assert selection['missing_requirements']==['source:styles.css']


@pytest.mark.asyncio
async def test_rendered_source_keeps_whitespace_line_ranges_and_real_file_labels():
    cases=[('src/styles.css','\n\nmain {\n\tcolor: red;\n}\n'),('src/App.jsx','\nexport default function App(){\n  return <main title="a & b">Hello</main>;\n}\n'),
           ('server.cjs','\nconst app = require("express")();\napp.listen(process.env.PORT);\n'),('index.html','<main>&amp; literal</main>\n<script>throw Error("must not execute")</script>\n')]
    async with async_playwright() as pw:
        browser=await launch_capture_browser(pw)
        try:
            page=await browser.new_page(java_script_enabled=False,viewport={'width':960,'height':300})
            await page.route('**/*',lambda r:r.abort())
            for filename,source in cases:
                rendered=await screenshot_service._render_template('', '', 'vscode',filename=filename,source_code=source,view_mode='editor',presentation='evidence',language='react')
                await page.set_content(rendered)
                lines=await page.locator('.line').evaluate_all('elements=>elements.map(e=>{const c=e.cloneNode(true);c.querySelector(".number").remove();return c.textContent})')
                assert lines==source.splitlines(),(filename,lines)
                assert filename in await page.locator('header').inner_text()
                assert await page.locator('script').count()==0
            source='\n\nconst first = 1;\nconst second = 2;\nconst third = 3;\n'
            rendered=await screenshot_service._render_template('', '', 'vscode',filename='src/main.js',source_code=source,view_mode='editor',presentation='evidence',start_line=3,end_line=4)
            await page.set_content(rendered)
            assert await page.locator('.number').all_text_contents()==['3','4']
            assert 'const third' not in await page.locator('pre').inner_text()
            assert 'const first' in await page.locator('pre').inner_text()
        finally:await browser.close()


@pytest.mark.asyncio
async def test_real_cjs_capture_preserves_header_and_long_source_without_horizontal_clip(tmp_path):
    source='const evidence = "'+('x'*6000)+'";\nconsole.log("LAST_SOURCE_LINE");\n'
    inspected=[]
    original=screenshot_service._take_screenshot
    async def inspect(html,path,**kwargs):
        assert 'server.cjs' in html and 'app.jsx' not in html
        assert 'LAST_SOURCE_LINE' in html
        inspected.append(True)
        return await original(html,path,**kwargs)
    with patch('app.services.screenshot_service.settings.SCREENSHOT_DIR',str(tmp_path)),patch.object(screenshot_service,'_take_screenshot',side_effect=inspect):
        ok,path,width,height=await screenshot_service.generate_screenshot(source,'',theme='vscode',job_id='long-source',filename='server.cjs',view_mode='editor',presentation='evidence',language='node')
    assert ok and inspected
    with Image.open(path) as image:assert image.width==960 and image.height==height and height>1000
