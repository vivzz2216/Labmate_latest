"""Generated tests must match actual elements, without weakening failed assertions."""
import pytest

from app.config import settings
from app.services.runtime_engine import runtime_engine


HTML = '''<!doctype html><html><body>
<button data-testid="filter" onclick="document.getElementById('dessert').remove();document.getElementById('quantity').textContent='Quantity: 2'">Starters</button>
<div data-testid="menu-grid">
  <article data-testid="menu-item">Soup</article>
  <article data-testid="menu-item">Salad</article>
  <article data-testid="menu-item" id="dessert">Cake</article>
</div><span data-testid="quantity" id="quantity">Quantity: 1</span>
</body></html>'''


def scenario(steps):
    return [{'version': 2, 'name': 'Menu filter', 'requirement_ids': ['filter'],
             'viewport': {'width': 1366, 'height': 768}, 'steps': steps}]


def step(action, locator, value='', kind='testid'):
    return {'action': action, 'locator_type': kind, 'locator': locator, 'value': value, 'role': ''}


@pytest.mark.asyncio
async def test_count_matches_cards_instead_of_their_container(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path))
    wrong = await runtime_engine._capture_html(HTML, scenario([
        step('click', 'filter'), step('assert_count', 'menu-grid', '3')]), True)
    assert not wrong.success and wrong.verification['status'] == 'failed'
    assert "count '3'" in wrong.error
    correct = await runtime_engine._capture_html(HTML, scenario([
        step('assert_count', 'menu-item', '3'), step('click', 'filter'),
        step('assert_count', 'menu-item', '2'), step('assert_absent', 'Cake', kind='text')]), True)
    assert correct.success and correct.verification['status'] == 'passed', correct.error


@pytest.mark.asyncio
async def test_displayed_quantity_requires_visible_text_instead_of_input_value(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'SCREENSHOT_DIR', str(tmp_path))
    wrong = await runtime_engine._capture_html(HTML, scenario([
        step('click', 'filter'), step('assert_value', 'quantity', '2')]), True)
    assert not wrong.success and wrong.verification['status'] == 'failed'
    assert 'input' in wrong.error.lower()
    correct = await runtime_engine._capture_html(HTML, scenario([
        step('click', 'filter'), step('assert_visible', 'Quantity: 2', kind='text')]), True)
    assert correct.success and correct.verification['status'] == 'passed', correct.error
