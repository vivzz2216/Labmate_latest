import pytest

from app.services.sql_runtime import execute_sql, expects_error


def test_expected_error_comment_detection():
    assert expects_error('EXPECTED ERROR: duplicate primary key')
    assert expects_error('This insert should fail because of the foreign key')
    assert not expects_error('Display all students')


def test_deliberate_constraint_violation_is_recorded_and_script_continues():
    sql = '''CREATE TABLE dept (id INT PRIMARY KEY, name VARCHAR(20));
INSERT INTO dept VALUES (1, 'IT');
-- EXPECTED ERROR: duplicate primary key is rejected
INSERT INTO dept VALUES (1, 'CS');
SELECT * FROM dept;'''
    result = execute_sql(sql)
    if 'MySQL' not in str(result.get('engine', '')) or not result.get('statements'):
        pytest.skip('MySQL is not available: ' + str(result.get('error')))
    assert result['success'] is True, result.get('error')
    failed = [s for s in result['statements'] if not s['success']]
    assert len(failed) == 1 and failed[0].get('expected_error') and 'Duplicate' in failed[0]['error']
    assert result['statements'][-1]['type'] == 'SELECT' and len(result['statements'][-1]['rows']) == 1
    assert 'EXPECTED ERROR' in result['stdout']


def test_unexpected_error_still_stops_the_script():
    result = execute_sql("CREATE TABLE t1 (id INT PRIMARY KEY);\nINSERT INTO t1 VALUES (1);\nINSERT INTO t1 VALUES (1);\nSELECT * FROM t1;")
    if not result.get('statements'):
        pytest.skip('MySQL is not available: ' + str(result.get('error')))
    assert result['success'] is False and len(result['statements']) == 3
