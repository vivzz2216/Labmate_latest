import pytest
from app.services.browser_scenarios import validate_coverage_plan


def test_click_navigation_must_check_url_and_page_content():
    requirements = [{'id': 'routes', 'kind': 'behavior'}]
    test = {'requirement_ids': ['routes'], 'steps': [
        {'action': 'click'}, {'action': 'assert_url'}, {'action': 'assert_visible'},
    ]}
    assert validate_coverage_plan(requirements, [test]) == ['routes']
    test['steps'] = [{'action': 'click'}, {'action': 'assert_visible'}]
    with pytest.raises(ValueError, match='routes'):
        validate_coverage_plan(requirements, [test])
