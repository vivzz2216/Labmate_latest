from pathlib import Path
import pytest
import pymysql

from app.services.manual_sections import numbered_experiments
from app.services.lab_question_filter import filter_lab_tasks
from app.services.sql_runtime import SQLSession, split_sql
from app.services.sql_instructions import sql_instructions


def test_join_repair_instructions_fix_missing_test_data():
    guidance = sql_instructions('Perform joins and views.')
    assert 'Employees 9 and 10 MUST have no orders' in guidance
    assert 'FIX THE INSERT DATA' in guidance
    assert 'Customers/Employees joins' in sql_instructions('Perform DDL operations.')
    assert 'For joins, include' not in sql_instructions('Perform DDL operations.')


def test_routine_delimiters_preserve_internal_semicolons_and_literals():
    script = """DELIMITER $$
CREATE PROCEDURE p()
BEGIN SELECT 'semi;colon $$ text'; SELECT 2; END$$
DELIMITER ;
CALL p();
SELECT 3;
"""
    statements = split_sql(script)
    assert len(statements) == 3
    assert statements[0].endswith('SELECT 2; END')
    assert statements[1:] == ['CALL p()', 'SELECT 3']


def test_procedure_manual_without_laboratory_heading_is_not_lost():
    text = ('Experiment 9: Implement Procedures\nAim: Implement procedures and functions.\n'
            'Pre-Experiment Exercise:\nBrief Theory: (To be handwritten)\nExplain procedures.\n'
            'B. Result/Observation/Program code: Attach output\nPROCEDURE:\n'
            'CREATE PROCEDURE p() SELECT 1;\nCALL p();\n'
            'Post Experimental Exercise-(Handwritten) A Questions:\nExplain the syntax.')
    tasks = numbered_experiments(text)
    assert len(tasks) == 1 and tasks[0]['language'] == 'sql'
    assert 'CALL p()' in tasks[0]['text'] and 'Explain procedures' not in tasks[0]['text']
    assert filter_lab_tasks(tasks)


def test_real_procedure_cursor_and_function_permissions():
    session = SQLSession()
    try:
        script = '''CREATE TABLE numbers(v INT); INSERT INTO numbers VALUES(2),(3);
DELIMITER $$
CREATE PROCEDURE total_values()
BEGIN
 DECLARE finished INT DEFAULT 0;
 DECLARE current_value INT;
 DECLARE total INT DEFAULT 0;
 DECLARE values_cursor CURSOR FOR SELECT v FROM numbers;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished=1;
 OPEN values_cursor;
 read_loop: LOOP
  FETCH values_cursor INTO current_value;
  IF finished THEN LEAVE read_loop; END IF;
  SET total=total+current_value;
 END LOOP;
 CLOSE values_cursor;
 SELECT total AS total;
END$$
CREATE FUNCTION double_value(v INT) RETURNS INT DETERMINISTIC NO SQL RETURN v*2$$
DELIMITER ;
CALL total_values(); SELECT double_value(4) AS doubled;'''
        result = session.execute_script(script)
        assert result['success'], result['error']
        assert result['select_results'][-2]['rows'] == [{'total': 5}]
        assert result['select_results'][-1]['rows'] == [{'doubled': 8}]
    finally:
        session.close()


def test_private_dcl_grants_are_real_reversible_and_isolated():
    session = SQLSession(allow_dcl=True)
    try:
        assert session.execute('CREATE TABLE employee(SSN INT, deptno INT)')['success']
        for sql in ["CREATE USER 'learner'@'localhost' IDENTIFIED BY 'Example123!'",
                    "GRANT SELECT ON lab.employee TO 'learner'@'localhost'",
                    "GRANT UPDATE(SSN) ON lab.employee TO 'learner'@'localhost'"]:
            result = session.execute(sql)
            assert result['success'], result
        actual, password = session.exercise_users['learner']
        config = session._admin_cfg
        conn = pymysql.connect(host=config['host'], port=config['port'], user=actual, password=password, database=session.physical_schema, autocommit=True)
        try:
            with conn.cursor() as cursor:
                cursor.execute('SELECT * FROM employee')
                with pytest.raises(pymysql.MySQLError):cursor.execute('UPDATE employee SET deptno=2')
        finally:conn.close()
        assert not session.execute("GRANT SELECT ON mysql.user TO 'learner'@'localhost'")['success']
        assert not session.execute("GRANT SELECT ON *.* TO 'learner'@'localhost'")['success']
        assert not session.execute("DROP USER root@localhost")['success']
        assert session.execute("REVOKE SELECT ON lab.employee FROM 'learner'@'localhost'")['success']
        grants = session.execute("SHOW GRANTS FOR 'learner'@'localhost'")
        assert grants['success'] and 'SELECT' not in str(grants['rows'])
    finally:session.close()


def test_quoted_routine_names_and_trigger_execution():
    session = SQLSession()
    try:
        assert session.execute("CREATE TABLE audit_log(id INT AUTO_INCREMENT PRIMARY KEY, msg VARCHAR(50))")['success']
        assert session.execute("CREATE TABLE items(id INT PRIMARY KEY, name VARCHAR(50))")['success']

        # Backtick quoted procedure
        proc_sql = """DELIMITER $$
CREATE PROCEDURE `proc_add_item`(IN p_id INT, IN p_name VARCHAR(50))
BEGIN
    INSERT INTO items VALUES (p_id, p_name);
END$$
DELIMITER ;"""
        res_proc = session.execute_script(proc_sql)
        assert res_proc['success'], res_proc.get('error')

        # Backtick quoted function
        func_sql = """DELIMITER $$
CREATE FUNCTION `func_item_count`() RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE cnt INT;
    SELECT COUNT(*) INTO cnt FROM items;
    RETURN cnt;
END$$
DELIMITER ;"""
        res_func = session.execute_script(func_sql)
        assert res_func['success'], res_func.get('error')

        # Backtick quoted trigger
        trg_sql = """DELIMITER $$
CREATE TRIGGER `trg_after_item_insert`
AFTER INSERT ON `items`
FOR EACH ROW
BEGIN
    INSERT INTO audit_log(msg) VALUES (CONCAT('Inserted ', NEW.name));
END$$
DELIMITER ;"""
        res_trg = session.execute_script(trg_sql)
        assert res_trg['success'], res_trg.get('error')

        # Execute procedure and verify trigger side-effect and function return
        call_res = session.execute("CALL `proc_add_item`(101, 'Widget')")
        assert call_res['success'], call_res.get('error')

        fn_res = session.execute("SELECT `func_item_count`() AS cnt")
        assert fn_res['success'] and fn_res['rows'] == [{'cnt': 1}]

        audit_res = session.execute("SELECT msg FROM audit_log")
        assert audit_res['success'] and audit_res['rows'] == [{'msg': 'Inserted Widget'}]
    finally:
        session.close()


def test_forbidden_definer_and_cross_schema_triggers():
    session = SQLSession()
    try:
        assert session.execute("CREATE TABLE t1(x INT)")['success']

        # Forbidden DEFINER attempts
        definer_cases = [
            "CREATE DEFINER='root'@'localhost' PROCEDURE p_bad() BEGIN SELECT 1; END",
            "CREATE DEFINER = CURRENT_USER FUNCTION f_bad(a INT) RETURNS INT DETERMINISTIC RETURN a",
            "CREATE DEFINER = 'admin'@'localhost' TRIGGER trg_bad AFTER INSERT ON t1 FOR EACH ROW BEGIN END",
        ]
        for sql in definer_cases:
            res = session.execute(sql)
            assert not res['success'], f"Expected failure for {sql}"
            assert 'Explicit DEFINER is prohibited' in res.get('error', '')

        # Cross-schema trigger target attempts
        cross_schema_cases = [
            ("CREATE TRIGGER trg_cross AFTER INSERT ON mysql.user FOR EACH ROW BEGIN END", ('Access to MySQL system schemas is not permitted', 'Trigger target must be an unqualified table in the private schema')),
            ("CREATE TRIGGER trg_cross2 AFTER INSERT ON other_schema.tbl FOR EACH ROW BEGIN END", ('Trigger target must be an unqualified table in the private schema',)),
            ("CREATE TRIGGER trg_cross3 AFTER INSERT ON other_schema . tbl FOR EACH ROW BEGIN END", ('Trigger target must be an unqualified table in the private schema',)),
        ]
        for sql, expected_errors in cross_schema_cases:
            res = session.execute(sql)
            assert not res['success'], f"Expected failure for {sql}"
            assert any(err in res.get('error', '') for err in expected_errors), f"Got unexpected error: {res.get('error')}"

        # Active schema qualified trigger target SHOULD succeed
        qualified_trg = f"""DELIMITER $$
CREATE TRIGGER trg_ok AFTER INSERT ON {session.active_schema}.t1 FOR EACH ROW
BEGIN
END$$
DELIMITER ;"""
        res_ok = session.execute_script(qualified_trg)
        assert res_ok['success'], res_ok.get('error')
    finally:
        session.close()


def test_dcl_privilege_escape_attempts_and_unqualified_tables():
    session = SQLSession(allow_dcl=True)
    try:
        assert session.execute("CREATE TABLE emp(id INT, name VARCHAR(20))")['success']

        # Protected administrative accounts cannot be created or targeted
        for protected in ('root', 'admin', 'administrator', 'mysql', 'sys'):
            res = session.execute(f"CREATE USER '{protected}'@'localhost' IDENTIFIED BY 'Pass123!'")
            assert not res['success'], f"Expected rejection for user '{protected}'"
            assert 'protected' in res.get('error', '').lower()

        # Create valid student user
        res_user = session.execute("CREATE USER 'student_a'@'localhost' IDENTIFIED BY 'Pass123!'")
        assert res_user['success'], res_user.get('error')

        # DCL privilege escalation attempts
        escape_cases = [
            "GRANT ALL PRIVILEGES ON *.* TO 'student_a'@'localhost'",
            "GRANT SELECT ON mysql.* TO 'student_a'@'localhost'",
            "GRANT SELECT ON mysql.user TO 'student_a'@'localhost'",
            "GRANT SUPER ON *.* TO 'student_a'@'localhost'",
            "GRANT SHUTDOWN ON *.* TO 'student_a'@'localhost'",
            "GRANT SELECT ON other_db.emp TO 'student_a'@'localhost'",
        ]
        for sql in escape_cases:
            res = session.execute(sql)
            assert not res['success'], f"Expected rejection for {sql}"

        # Unqualified table name in active schema must succeed (SQLExp7 style)
        grant_unqual = session.execute("GRANT SELECT, INSERT ON emp TO 'student_a'@'localhost'")
        assert grant_unqual['success'], grant_unqual.get('error')

        # SHOW GRANTS verifies the grant
        show_res = session.execute("SHOW GRANTS FOR 'student_a'@'localhost'")
        assert show_res['success']
        assert any('SELECT' in str(row) and 'INSERT' in str(row) for row in show_res['rows'])

        # Unqualified REVOKE must also succeed
        revoke_res = session.execute("REVOKE INSERT ON emp FROM 'student_a'@'localhost'")
        assert revoke_res['success'], revoke_res.get('error')

        show_res2 = session.execute("SHOW GRANTS FOR 'student_a'@'localhost'")
        assert show_res2['success']
        assert not any('INSERT' in str(row) for row in show_res2['rows'])
    finally:
        session.close()
