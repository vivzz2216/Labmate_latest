import pytest

from app.services.evidence_planner import plan_experiment
from app.services.web_generation_protocol import canonical_web_data
from app.services.web_project import web_requirements


@pytest.mark.parametrize('objective,expected', [
    ('Create a portfolio using HTML, CSS and JavaScript.', False),
    ('Create a mobile phone shop catalogue.', False),
    ('Create a responsive portfolio.', True),
    ('Use CSS media queries for small screens.', True),
    ('Test the layout on mobile and desktop.', True),
    ('Make a mobile-friendly registration form.', True),
])
def test_planners_agree_on_explicit_responsive_request(objective, expected):
    assert plan_experiment(objective, 'html', '')['responsive_required'] is expected
    assert any(r['id'] == 'responsive' for r in web_requirements(objective, 'html')) is expected


@pytest.mark.parametrize('requested', [False, True])
def test_mobile_viewport_only_preserved_when_required(requested):
    raw = {'browser_tests': [{'name': 'Check calculation', 'requirement_ids': ['calculation', 'responsive'],
        'viewport': {'width': 390, 'height': 844}, 'steps': []}]}
    requirements = [{'id': 'calculation', 'kind': 'behavior'}]
    if requested:
        requirements.append({'id': 'responsive', 'kind': 'behavior'})
    result = canonical_web_data(raw, {'properties': {'browser_tests': {}}}, requirements)
    test = result['browser_tests'][0]
    assert test['viewport']['width'] == (390 if requested else 1366)
    assert ('responsive' in test['requirement_ids']) is requested
    assert raw['browser_tests'][0]['viewport']['width'] == 390
