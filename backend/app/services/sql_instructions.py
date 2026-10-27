"""Task-specific MySQL instructions shared by generation and repair."""
import re


def sql_instructions(question: str) -> str:
    text = question or ''
    instructions = (
        '\nMYSQL RUNTIME: Return a complete self-contained MySQL 8 script for THIS exercise only. '
        'Use INT AUTO_INCREMENT, VARCHAR, valid dates and backtick identifiers. Adapt Oracle/SQL Server '
        'examples to MySQL and explain that adaptation briefly. Never invent a required view or table name '
        'without creating it. Populate realistic data meeting the manual counts. Capture base tables with '
        'SELECT, then SELECT evidence after each required operation (including SHOW CREATE TABLE for DDL). '
        'Use only a private logical database. Do not access server system schemas or run shell commands. '
        'Start with DROP DATABASE IF EXISTS for the private demo database, CREATE DATABASE and USE, so a repeated run is deterministic. '
        'Do not DROP the database or main tables at the end; runtime isolation handles cleanup after evidence capture. '
        'Use YYYY-MM-DD dates. For SQL fixtures, use realistic neutral domain names instead of repeating the account name. '
        'SQL header fields without genuine supplied values must be omitted, including the generic name Student. '
        'Do not include invented student/class/institution details in comments. '
        'Do not add unrelated Customers/Employees joins or product views to other exercises. '
    )
    if re.search(r'\b(?:constraints?|DDL)\b', text, re.I):
        instructions += (
            'When demonstrating constraints (NOT NULL, UNIQUE, PRIMARY KEY, FOREIGN KEY, CHECK, DEFAULT), '
            'ensure referenced parent tables retain a PRIMARY KEY on their referenced ID column before child tables add FOREIGN KEY. '
            'In MySQL 8, expressions and date functions in column DEFAULT clauses MUST be enclosed in parentheses, e.g. `DEFAULT (CURRENT_DATE)` or use literal constants. '
        )
    if re.search(r'\bHAVING\b', text, re.I):
        instructions += 'For HAVING COUNT(CustomerID)>5, put at least SIX customers in one country so the saved result demonstrates a passing group. '
    if re.search(r'\bDML\b', text, re.I):
        instructions += 'Demonstrate a single-row UPDATE with a key-based WHERE clause and capture before/after SELECT results. Use the same table name consistently. '
    if re.search(r'\btriggers?\b', text, re.I):
        instructions += ('Only create the requested triggers and required tables, not unrelated views. '
                         'For WorkCenters inserts of 100 then 200, accumulated totalCapacity must be 100 then 300. '
                         'Use matching DELIMITER directives, restore DELIMITER ; after definitions, and show effects before dropping any trigger. ')
    if re.search(r'\bjoins?\b', text, re.I):
        instructions += (
            'For joins, include INNER/LEFT/RIGHT examples and a FULL OUTER equivalent using UNION ALL '
            'and an unmatched-right branch. A correct RIGHT JOIN retains ALL right-side rows. '
            'IMPORTANT SAMPLE DATA: Use 10 Employees, with orders referencing ONLY employees 1 through 8. '
            'Employees 9 and 10 MUST have no orders. Also retain customers without orders and an order with '
            'CustomerID NULL. Never remove NULL OrderID rows. If verification reports missing unmatched '
            'employees, FIX THE INSERT DATA, not just the already-correct RIGHT JOIN SQL. '
        )
    if re.search(r'\bviews?\b', text, re.I):
        instructions += (
            'Create and query the requested views before dropping them. Correct the manual reference to '
            'an uncreated Products Above AveragePrice view by querying the view actually created. '
            'For the product_data example, demonstrate qty*price (3*50=150 and 5*60=300) and WHERE qty=5. '
        )
    if re.search(r'\b(?:procedure|cursor|function|trigger)s?\b', text, re.I):
        instructions += (
            'Use DELIMITER $$ around multi-statement routines/triggers, then DELIMITER ;. '
            'Include CREATE PROCEDURE, a cursor procedure and a deterministic NO SQL function when the aim '
            'requests procedures/cursors/functions. CALL procedures with valid arguments, SELECT the function '
            'and demonstrate trigger effects with SELECT before/after the triggering write. Never SET GLOBAL. '
        )
    if re.search(r'\b(?:GRANT|REVOKE|DCL|authorization)\b', text, re.I):
        instructions += (
            "DCL EXERCISE: Create a private logical database and employee table, then CREATE USER 'learner'@'localhost' "
            "IDENTIFIED BY 'ExampleOnly123!'; GRANT SELECT, INSERT, DELETE ON your_database.employee TO 'learner'@'localhost'; "
            "SHOW GRANTS FOR 'learner'@'localhost'; demonstrate column UPDATE(SSN) grant, SHOW GRANTS, REVOKE each "
            "privilege and SHOW GRANTS after revocation. The adapter maps learner to a temporary private MySQL account "
            "and uses a generated password; explain this. Never grant ON *.*, WITH GRANT OPTION, access mysql.user, "
            "ALTER USER, switch to root or run system/mysql CLI commands. Optional global administration examples in "
            "the manual are adapted to private-schema authorization and must not be claimed server-wide. "
        )
    return instructions
