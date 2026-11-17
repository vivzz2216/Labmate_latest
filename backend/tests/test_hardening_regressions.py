"""Regression tests for the hardening fixes: SQL identifier parsing, template escaping, GLM redirects."""
import inspect

import pytest
from jinja2 import Environment, FileSystemLoader

from app.services import glm_service, sql_accounts
from app.services.sql_accounts import PRIVILEGES, execute_dcl


class _Cursor:
    def __init__(self, log):
        self.log = log

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.log.append((sql, params))

    def fetchall(self):
        return []


class _Connection:
    def __init__(self, log):
        self.log = log

    def cursor(self):
        return _Cursor(self.log)

    def close(self):
        pass


class _FakeSession:
    allow_dcl = True
    db_user = 'labmate_runner'
    session_token = 'abc123'
    active_schema = 'school'
    schema_map = {'school': 'run_school'}

    def __init__(self):
        self.exercise_users = {'alice': ('labd_abc123_0', 'pw')}
        self.executed = []
        self.opened = 0

    def _find_logical_schema(self, name):
        return name

    def _open_admin_connection(self):
        self.opened += 1
        return _Connection(self.executed)

    def _failure(self, message, started, kind='ERROR', stmt=''):
        return {'ok': False, 'message': message}

    def _ok(self, **kwargs):
        return {'ok': True, **kwargs}


@pytest.mark.parametrize('statement', [
    "GRANT SELECT ON school.`bad`tbl TO alice",
    "GRANT SELECT ON `sch`ool.students TO alice",
    "GRANT SELECT (`na`me) ON school.students TO alice",
    "GRANT SELECT ON school.`students TO alice",
])
def test_grant_rejects_backticks_inside_identifiers(statement):
    session = _FakeSession()
    result = execute_dcl(session, statement, 0.0)
    assert result['ok'] is False
    assert session.executed == [], 'a malformed identifier must never reach MySQL'


@pytest.mark.parametrize('statement, expected', [
    ("GRANT SELECT ON school.students TO alice", "GRANT SELECT ON `run_school`.`students`"),
    ("GRANT SELECT ON school.`students` TO alice", "GRANT SELECT ON `run_school`.`students`"),
    ("GRANT SELECT (name, `roll_no`) ON school.students TO alice", "GRANT SELECT (name, `roll_no`) ON `run_school`.`students`"),
    ("REVOKE INSERT ON school.* FROM alice", "REVOKE INSERT ON `run_school`.*"),
])
def test_grant_accepts_plain_and_balanced_identifiers(statement, expected):
    session = _FakeSession()
    result = execute_dcl(session, statement, 0.0)
    assert result['ok'] is True, result
    assert session.executed[0][0].startswith(expected)


def test_privilege_pattern_still_accepts_column_lists():
    assert PRIVILEGES.fullmatch('SELECT, INSERT')
    assert PRIVILEGES.fullmatch('ALL PRIVILEGES')
    assert PRIVILEGES.fullmatch('SELECT (a, b)')
    assert not PRIVILEGES.fullmatch('SELECT (a`, b)')
    assert not PRIVILEGES.fullmatch('GRANT OPTION')


def test_terminal_output_is_html_escaped_in_vscode_theme():
    from app.services.screenshot_service import ScreenshotService

    template_dir = ScreenshotService().template_dir
    template = Environment(loader=FileSystemLoader(template_dir), autoescape=True).get_template('vscode_theme.html')
    rendered = template.render(output_content='<style>body{display:none}</style><b>hi</b>', error_content='',
                               username='Student', filename='main.py', project_name='lab',
                               highlighted_code='', code_content='', session_segments=[], project_files={},
                               screenshot_style='default', view_mode='split', start_line=1, end_line=1)
    assert '<style>body{display:none}</style>' not in rendered
    assert '&lt;style&gt;body{display:none}&lt;/style&gt;' in rendered


def test_glm_client_never_follows_redirects_with_the_bearer_token():
    source = inspect.getsource(glm_service)
    assert 'follow_redirects=True' not in source
    assert 'follow_redirects=False' in source


def test_sql_accounts_exports_unchanged_entry_point():
    assert callable(sql_accounts.execute_dcl)
