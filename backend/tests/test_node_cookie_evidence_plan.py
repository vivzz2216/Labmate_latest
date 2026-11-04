from app.services.evidence_planner import plan_experiment


def test_cookie_server_requires_http_evidence_not_browser():
    plan = plan_experiment('Create an Express app that sets and reads a cookie.', 'node', 'app.listen(3000)')
    assert plan['category'] == 'api'
    assert next(x for x in plan['requirements'] if x['id'] == 'execution')['evidence'] == 'http'


def test_node_rendered_page_still_requires_browser_evidence():
    plan = plan_experiment('Create a Node web page with HTML.', 'node', 'app.listen(3000)')
    assert plan['category'] == 'browser'
