import pytest
from app.services.lab_capture import capture_sql
from app.services.sql_runtime import SQLSession, verify_sql_exercise

OBJECTIVE = 'Perform complex queries using GROUP BY, HAVING and nested queries.'
SCRIPT = '''CREATE DATABASE grouped_queries_lab;
USE grouped_queries_lab;
CREATE TABLE marks (id INT PRIMARY KEY, department VARCHAR(10), score INT);
INSERT INTO marks VALUES (1,'CS',80),(2,'CS',90),(3,'IT',70);
SELECT * FROM marks;
SELECT department, COUNT(*) AS students, AVG(score) AS average FROM marks GROUP BY department;
SELECT department, COUNT(*) AS students FROM marks GROUP BY department HAVING COUNT(*) > 1;
SELECT * FROM marks WHERE score > (SELECT AVG(score) FROM marks);
SELECT COUNT(*) AS total, AVG(score) AS average, SUM(score) AS total_score, MAX(score) AS highest, MIN(score) AS lowest FROM marks;'''


@pytest.mark.asyncio
async def test_practical_has_every_operation_in_order_and_exact_results():
    result = await capture_sql(SCRIPT, filename='grouped_queries.sql', objective=OBJECTIVE)
    assert result.success, result.error
    v = result.verification
    steps = [f for f in v['evidence_frames'] if f['kind'] == 'database']
    assert [f['statement_index'] for f in steps] == [s['index'] for s in v['statements'] if s['type']=='SELECT']
    assert len(steps) == v['expected_database_frames'] == 5
    selects = [s for s in v['statements'] if s['type'] == 'SELECT']
    assert len(selects[0]['rows']) == 3
    assert selects[2]['rows'] == [{'department': 'CS', 'students': 2}]
    assert selects[3]['rows'] == [{'id': 2, 'department': 'CS', 'score': 90}]
    assert selects[4]['rows'] == [{'total':3,'average':80,'total_score':240,'highest':90,'lowest':70}]
    pages=[f for f in v['evidence_frames'] if f['kind']=='source_preview' and f.get('result_complete')]
    assert [f['result_statement_index'] for f in pages]==[s['index'] for s in selects]
    assert any(f['caption'].startswith('GROUP BY example') for f in pages)
    assert any(f['caption'].startswith('HAVING example') for f in pages)
    assert any(f['caption'].startswith('Nested query example') for f in pages)


@pytest.mark.parametrize('script', [SCRIPT.replace('SELECT * FROM marks;', ''), SCRIPT.replace('grouped_queries_lab','mini_project_demo')])
def test_incomplete_practical_cannot_pass(script):
    session = SQLSession()
    try:
        receipt = session.execute_script(script)
        assert receipt['success'], receipt.get('error')
        verified = verify_sql_exercise(OBJECTIVE, script, receipt)
        assert not verified['verified']
        assert verified['failures']
    finally:
        session.close()
