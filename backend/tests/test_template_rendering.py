import os
import pytest
from jinja2 import Environment, FileSystemLoader

from app.services.screenshot_service import ScreenshotService


TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "templates")
)


def test_vscode_evidence_direct_render_handles_empty_symbols_and_css():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=True)
    tmpl = env.get_template("vscode_evidence.html")
    html = tmpl.render(
        filename="src/main.py",
        basename="main.py",
        path_parts=["src", "main.py"],
        view_mode="output",
        palette="dark",
        vscode_logo="",
        explorer_rows=[],
        file_kind="python",
        indent_size=4,
        language_label="Python",
        icon_symbols={},
        codicon_font="",
        seti_font="",
        file_symbol={},
        highlight_css=".code-highlight > span { color: 'red'; }",
        highlighted_code="<span>1</span>",
        output_content="ok",
        error_content="",
        source_ranges=[[1, 1]],
    )
    assert "{ {" not in html
    assert "&gt;" not in html.split("</style>", 1)[0]
    assert ".code-highlight > span" in html
    assert "integrated terminal" in html.lower() or "execution capture" in html.lower()
    assert "source preview</title>" not in html


@pytest.mark.asyncio
async def test_vscode_evidence_terminal_mode_hides_editor_tabs_and_unescapes_style():
    svc = ScreenshotService()
    html = await svc._render_template(
        highlighted_code="",
        output="hello\n",
        theme="vscode",
        filename="src/main.py",
        source_code="print('hello')\n",
        presentation="vscode_evidence",
        view_mode="output",
        language="python",
    )
    style_block = html.split("</style>", 1)[0]
    assert "&gt;" not in style_block
    assert "&#39;" not in style_block
    assert "{ {" not in html
    assert '<div class="tabs">' not in html
    assert '<div class="breadcrumbs">' not in html


@pytest.mark.asyncio
async def test_evidence_theme_does_not_html_escape_highlight_css():
    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR), autoescape=True)
    direct = env.get_template("evidence_theme.html").render(
        filename="script.py",
        view_mode="editor",
        palette="light",
        foreground="#18181b",
        background="#ffffff",
        bar_background="#f4f4f5",
        error_color="#a40000",
        highlight_css=".code-highlight > span { color: 'blue'; }",
        highlighted_code="<span>x = 1</span>",
        output_content="1",
        error_content="",
        evidence_kind="terminal",
    )
    assert ".code-highlight > span" in direct
    assert "&gt;" not in direct.split("</style>", 1)[0]
    assert "&#39;" not in direct.split("</style>", 1)[0]

    svc = ScreenshotService()
    html = await svc._render_template(
        highlighted_code="",
        output="x=1",
        theme="idle",
        filename="script.py",
        source_code="x = 1\n",
        presentation="evidence",
        view_mode="editor",
        language="python",
    )
    style_block = html.split("</style>", 1)[0]
    assert "&gt;" not in style_block
    assert "&#39;" not in style_block
    assert "&#34;" not in style_block


@pytest.mark.asyncio
async def test_vscode_theme_escapes_terminal_output_html():
    svc = ScreenshotService()
    html = await svc._render_template(
        highlighted_code="<span>console.log(1)</span>",
        output="vector<int> <script>alert(1)</script>",
        theme="vscode",
        filename="app.js",
        source_code="console.log(1);",
    )
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    assert "vector&lt;int&gt;" in html


@pytest.mark.asyncio
async def test_browser_preview_theme_forwards_preview_image():
    svc = ScreenshotService()
    html = await svc._render_template(
        highlighted_code="",
        output="",
        theme="browser_preview",
        filename="index.html",
        source_code="<h1>Hi</h1>",
        preview_image="iVBORw0KGgoAAAANS",
    )
    assert "data:image/png;base64,iVBORw0KGgoAAAANS" in html


@pytest.mark.asyncio
async def test_idle_theme_has_no_dead_script_tag():
    svc = ScreenshotService()
    html = await svc._render_template(
        highlighted_code="<span>print(1)</span>",
        output="1\n",
        theme="idle",
        filename="lab.py",
        source_code='print("1")\n',
    )
    assert "<script" not in html.lower()
    assert ".scrollbar-thumb" in html


def test_highlight_code_selects_lexer_from_filename_extension():
    svc = ScreenshotService()
    css_html = svc._highlight_code("body { color: #fff; }", theme="vscode", filename="styles.css")
    assert 'class="tag">body<' in css_html
    assert 'class="nb">color<' in css_html or 'color' in css_html


@pytest.mark.asyncio
async def test_project_name_forwarded_to_vscode_and_codeblocks():
    svc = ScreenshotService()
    vscode_html = await svc._render_template(
        highlighted_code="<span>x</span>",
        output="ok",
        theme="vscode",
        filename="index.js",
        source_code="console.log(1)",
        project_name="custom-lab-proj",
    )
    cb_html = await svc._render_template(
        highlighted_code="<span>int main(){}</span>",
        output="ok",
        theme="codeblocks",
        filename="main.cpp",
        source_code="int main(){return 0;}",
        project_name="custom-cpp-proj",
    )
    assert "custom-lab-proj" in vscode_html
    assert "custom-cpp-proj" in cb_html


def test_dead_wrapper_and_broken_templates_removed():
    for name in ("runtime_theme.html", "html_theme.html", "node_theme.html", "react_theme.html"):
        assert not os.path.exists(os.path.join(TEMPLATES_DIR, name)), f"{name} should be removed"
