import asyncio
import os
import pytest
import pymysql

from app.config import settings
from app.services.sql_runtime import SQLSession, execute_sql, verify_sql_exercise
from app.security.validators import normalize_output_name
from app.routers.workflows import ProcessInput


def test_output_name_normalization_and_422_fix():
    # Exact problematic cases from user report
    assert normalize_output_name("SQL_EXP6.docx (1).pdf") == "SQL_EXP6_1"
    assert normalize_output_name("SQL_EXP6.docx__1_") == "SQL_EXP6_1"
    assert normalize_output_name("SQL_EXP6.docx (1)") == "SQL_EXP6_1"
    assert normalize_output_name("my_lab.report.v2.docx.pdf") == "my_lab_report_v2"
    assert normalize_output_name("  ---Experiment #6: Joins & Views (Final).pdf--- ") == "Experiment_6_Joins_Views_Final"

    # ProcessInput should normalize messy output_name instead of throwing 422
    payload = ProcessInput(
        questions=[{"id": 1, "text": "SELECT 1;", "language": "sql"}],
        output_name="SQL_EXP6.docx (1)",
        language="sql",
    )
    assert payload.output_name == "SQL_EXP6_1"


def test_mysql_session_real_execution_and_cleanup():
    session = SQLSession(timeout=5.0)
    isolated_schema = session.physical_schema
    restricted_user = session.db_user
    try:
        assert session.dialect == "mysql"
        assert session.server_version
        assert not hasattr(session, "conn_sqlite")

        res = session.execute("CREATE TABLE items (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));")
        assert res["success"] is True
        assert res["dialect"] == "mysql"
        assert res["server_version"] == session.server_version

        res_ins = session.execute("INSERT INTO items (name) VALUES ('Widget'), ('Gadget');")
        assert res_ins["success"] is True
        assert res_ins["rowcount"] == 2

        res_sel = session.execute("SELECT id, name FROM items ORDER BY id;")
        assert res_sel["success"] is True
        assert res_sel["columns"] == ["id", "name"]
        assert res_sel["rows"] == [{"id": 1, "name": "Widget"}, {"id": 2, "name": "Gadget"}]
    finally:
        session.close()

    # Verify schema and restricted user were cleaned up in MySQL
    admin_conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_ADMIN_USER,
        password=settings.MYSQL_ADMIN_PASSWORD,
        autocommit=True,
    )
    try:
        with admin_conn.cursor() as cur:
            cur.execute("SHOW DATABASES LIKE %s", (isolated_schema,))
            assert cur.fetchall() == (), f"Isolated schema {isolated_schema} was not dropped on close()"
            cur.execute("SELECT User FROM mysql.user WHERE User = %s", (restricted_user,))
            assert cur.fetchall() == (), f"Restricted user {restricted_user} was not dropped on close()"
    finally:
        admin_conn.close()


def test_mysql_schema_isolation_and_concurrent_runs():
    s1 = SQLSession(timeout=5.0)
    s2 = SQLSession(timeout=5.0)
    try:
        assert s1.physical_schema != s2.physical_schema
        assert s1.db_user != s2.db_user

        assert s1.execute("CREATE TABLE secret_data (secret VARCHAR(100));")["success"] is True
        assert s1.execute("INSERT INTO secret_data VALUES ('s1_only');")["success"] is True

        assert s2.execute("CREATE TABLE secret_data (secret VARCHAR(100));")["success"] is True
        assert s2.execute("INSERT INTO secret_data VALUES ('s2_only');")["success"] is True

        # s2 must not be able to query s1's physical schema or mysql.user
        cross_res = s2.execute(f"SELECT * FROM `{s1.physical_schema}`.secret_data;")
        assert cross_res["success"] is False

        sys_res = s2.execute("SELECT User, Host FROM mysql.user;")
        assert sys_res["success"] is False

        priv_res = s2.execute("GRANT ALL PRIVILEGES ON *.* TO CURRENT_USER();")
        assert priv_res["success"] is False

        r1 = s1.execute("SELECT secret FROM secret_data;")
        r2 = s2.execute("SELECT secret FROM secret_data;")
        assert r1["rows"] == [{"secret": "s1_only"}]
        assert r2["rows"] == [{"secret": "s2_only"}]
    finally:
        s1.close()
        s2.close()


def test_mysql_connection_failure_does_not_fallback_to_sqlite():
    with pytest.raises(RuntimeError, match="MySQL"):
        SQLSession(timeout=2.0, port=3399)


def test_mysql_timeout_enforcement():
    session = SQLSession(timeout=0.6)
    try:
        res = session.execute("SELECT SLEEP(5);")
        assert res["success"] is False
        assert "timeout" in res["error"].lower() or "exceeded" in res["error"].lower() or "interrupted" in res["error"].lower()

        # Session should still be able to run a normal query after timeout
        follow_up = session.execute("SELECT 1 + 1 AS two;")
        assert follow_up["success"] is True
        assert follow_up["rows"] == [{"two": 2}]
    finally:
        session.close()


def test_mysql_joins_views_and_semantic_verification():
    sql = """
    CREATE TABLE Customers (
        CustomerID INT AUTO_INCREMENT PRIMARY KEY,
        CustomerName VARCHAR(100) NOT NULL,
        ContactName VARCHAR(100),
        Country VARCHAR(50) NOT NULL
    );

    CREATE TABLE Employees (
        EmployeeID INT AUTO_INCREMENT PRIMARY KEY,
        LastName VARCHAR(50) NOT NULL,
        FirstName VARCHAR(50) NOT NULL,
        BirthDate DATE
    );

    CREATE TABLE Orders (
        OrderID INT PRIMARY KEY,
        CustomerID INT NULL,
        EmployeeID INT NULL,
        OrderDate DATE NOT NULL,
        FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
        FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
    );

    INSERT INTO Customers (CustomerID, CustomerName, ContactName, Country) VALUES
    (1, 'Alfreds Futterkiste', 'Maria Anders', 'Germany'),
    (2, 'Ana Trujillo Emparedados', 'Ana Trujillo', 'Mexico'),
    (3, 'Antonio Moreno Taqueria', 'Antonio Moreno', 'Mexico'),
    (4, 'Around the Horn', 'Thomas Hardy', 'UK'),
    (5, 'Comercio Mineiro', 'Pedro Afonso', 'Brazil'),
    (6, 'Familia Arquibaldo', 'Aria Cruz', 'Brazil'),
    (7, 'Que Delicia', 'Bernardo Batista', 'Brazil'),
    (8, 'Paris Specialties', 'Marie Bertrand', 'France');

    INSERT INTO Employees (EmployeeID, LastName, FirstName, BirthDate) VALUES
    (1, 'Davolio', 'Nancy', '1968-12-08'),
    (2, 'Fuller', 'Andrew', '1972-02-19'),
    (3, 'Leverling', 'Janet', '1983-08-30'),
    (4, 'Peacock', 'Margaret', '1977-09-19'),
    (5, 'Buchanan', 'Steven', '1975-03-04'),
    (6, 'Suyama', 'Michael', '1981-07-02'),
    (7, 'King', 'Robert', '1980-05-29'),
    (8, 'Callahan', 'Laura', '1978-01-09');

    INSERT INTO Orders (OrderID, CustomerID, EmployeeID, OrderDate) VALUES
    (10308, 2, 1, '1996-09-18'),
    (10309, 3, 2, '1996-09-19'),
    (10310, 5, 3, '1996-09-20'),
    (10311, 6, 4, '1996-09-21'),
    (10312, 7, 5, '1996-09-22'),
    (10313, 1, 6, '1996-09-23'),
    (10314, 5, 1, '1996-09-24'),
    (10315, NULL, 2, '1996-09-25');

    -- 1. INNER JOIN
    SELECT Orders.OrderID, Customers.CustomerName, Orders.OrderDate
    FROM Orders
    INNER JOIN Customers ON Orders.CustomerID = Customers.CustomerID
    ORDER BY Orders.OrderID;

    -- 2. LEFT OUTER JOIN (preserves customers 4 and 8 who have no orders)
    SELECT Customers.CustomerName, Orders.OrderID
    FROM Customers
    LEFT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
    ORDER BY Customers.CustomerName, Orders.OrderID;

    -- 3. RIGHT OUTER JOIN (Orders RIGHT JOIN Employees preserves all employees including 7 and 8 with no orders)
    SELECT Orders.OrderID, Employees.LastName, Employees.FirstName
    FROM Orders
    RIGHT JOIN Employees ON Orders.EmployeeID = Employees.EmployeeID
    ORDER BY Employees.EmployeeID, Orders.OrderID;

    -- 4. FULL OUTER JOIN equivalent in MySQL (preserves unmatched Customers AND unmatched Orders, plus duplicates)
    SELECT Customers.CustomerName, Orders.OrderID
    FROM Customers
    LEFT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
    UNION ALL
    SELECT Customers.CustomerName, Orders.OrderID
    FROM Customers
    RIGHT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
    WHERE Customers.CustomerID IS NULL
    ORDER BY CustomerName, OrderID;

    -- 5. Views
    CREATE VIEW `Brazil_Customers` AS
    SELECT CustomerName, ContactName
    FROM Customers
    WHERE Country = 'Brazil';

    SELECT * FROM `Brazil_Customers`;

    CREATE TABLE Products (
        id INT PRIMARY KEY,
        item VARCHAR(50),
        qty INT,
        price INT
    );
    INSERT INTO Products (id, item, qty, price) VALUES
    (1, 'pen', 5, 60),
    (2, 'notebook', 10, 45),
    (3, 'marker', 4, 80),
    (4, 'folder', 8, 30),
    (5, 'stapler', 2, 150),
    (6, 'eraser', 12, 15),
    (7, 'highlighter', 6, 50),
    (8, 'ruler', 9, 25);

    CREATE VIEW product_data AS
    SELECT item, qty, price, qty * price AS value
    FROM Products;

    SELECT * FROM product_data;
    SELECT * FROM product_data WHERE qty = 5;
    DROP VIEW product_data;
    """

    result = execute_sql(sql)
    assert result["success"] is True
    assert result["dialect"] == "mysql"

    verification = verify_sql_exercise(
        objective="Execute SQL Joins (INNER, LEFT, RIGHT, FULL OUTER) and Views (Brazil_Customers, product_data)",
        code=sql,
        execution_result=result,
    )
    assert verification["verified"] is True, f"Verification failed: {verification}"

    # Verify that a broken RIGHT JOIN (filtering out unmatched employees) is rejected by semantic verification
    bad_sql = sql.replace(
        "RIGHT JOIN Employees ON Orders.EmployeeID = Employees.EmployeeID",
        "RIGHT JOIN Employees ON Orders.EmployeeID = Employees.EmployeeID WHERE Orders.OrderID IS NOT NULL",
    )
    bad_result = execute_sql(bad_sql)
    bad_verification = verify_sql_exercise(
        objective="Execute SQL Joins (INNER, LEFT, RIGHT, FULL OUTER) and Views",
        code=bad_sql,
        execution_result=bad_result,
    )
    assert bad_verification["verified"] is False


def test_workbench_consistent_sql_capture_and_pagination():
    from PIL import Image
    from app.services.lab_capture import capture_sql

    sql = """-- Experiment 6: SQL Joins & Views
CREATE TABLE Customers (
    CustomerID INT AUTO_INCREMENT PRIMARY KEY,
    CustomerName VARCHAR(100) NOT NULL,
    ContactName VARCHAR(100),
    Country VARCHAR(50) NOT NULL
);

CREATE TABLE Employees (
    EmployeeID INT AUTO_INCREMENT PRIMARY KEY,
    LastName VARCHAR(50) NOT NULL,
    FirstName VARCHAR(50) NOT NULL,
    BirthDate DATE
);

CREATE TABLE Orders (
    OrderID INT PRIMARY KEY,
    CustomerID INT NULL,
    EmployeeID INT NULL,
    OrderDate DATE NOT NULL,
    FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

INSERT INTO Customers (CustomerID, CustomerName, ContactName, Country) VALUES
(1, 'Alfreds Futterkiste', 'Maria Anders', 'Germany'),
(2, 'Ana Trujillo Emparedados', 'Ana Trujillo', 'Mexico'),
(3, 'Antonio Moreno Taqueria', 'Antonio Moreno', 'Mexico'),
(4, 'Around the Horn', 'Thomas Hardy', 'UK'),
(5, 'Comercio Mineiro', 'Pedro Afonso', 'Brazil'),
(6, 'Familia Arquibaldo', 'Aria Cruz', 'Brazil'),
(7, 'Que Delicia', 'Bernardo Batista', 'Brazil'),
(8, 'Paris Specialties', 'Marie Bertrand', 'France');

INSERT INTO Employees (EmployeeID, LastName, FirstName, BirthDate) VALUES
(1, 'Davolio', 'Nancy', '1968-12-08'),
(2, 'Fuller', 'Andrew', '1972-02-19'),
(3, 'Leverling', 'Janet', '1983-08-30'),
(4, 'Peacock', 'Margaret', '1977-09-19'),
(5, 'Buchanan', 'Steven', '1975-03-04'),
(6, 'Suyama', 'Michael', '1981-07-02'),
(7, 'King', 'Robert', '1980-05-29'),
(8, 'Callahan', 'Laura', '1978-01-09');

INSERT INTO Orders (OrderID, CustomerID, EmployeeID, OrderDate) VALUES
(10308, 2, 1, '1996-09-18'),
(10309, 3, 2, '1996-09-19'),
(10310, 5, 3, '1996-09-20'),
(10311, 6, 4, '1996-09-21'),
(10312, 7, 5, '1996-09-22'),
(10313, 1, 6, '1996-09-23'),
(10314, 5, 1, '1996-09-24'),
(10315, NULL, 2, '1996-09-25');

SELECT Orders.OrderID, Customers.CustomerName, Orders.OrderDate
FROM Orders
INNER JOIN Customers ON Orders.CustomerID = Customers.CustomerID
ORDER BY Orders.OrderID;

SELECT Customers.CustomerName, Orders.OrderID
FROM Customers
LEFT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
ORDER BY Customers.CustomerName, Orders.OrderID;

SELECT Orders.OrderID, Employees.LastName, Employees.FirstName
FROM Orders
RIGHT JOIN Employees ON Orders.EmployeeID = Employees.EmployeeID
ORDER BY Employees.EmployeeID, Orders.OrderID;

SELECT Customers.CustomerName, Orders.OrderID
FROM Customers
LEFT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
UNION ALL
SELECT Customers.CustomerName, Orders.OrderID
FROM Customers
RIGHT JOIN Orders ON Customers.CustomerID = Orders.CustomerID
WHERE Customers.CustomerID IS NULL
ORDER BY CustomerName, OrderID;

CREATE VIEW `Brazil_Customers` AS
SELECT CustomerName, ContactName
FROM Customers
WHERE Country = 'Brazil';

SELECT * FROM `Brazil_Customers`;

CREATE TABLE Products (
    id INT PRIMARY KEY,
    item VARCHAR(50),
    qty INT,
    price INT
);

INSERT INTO Products (id, item, qty, price) VALUES
(1, 'pen', 5, 60),
(2, 'notebook', 10, 45),
(3, 'marker', 4, 80),
(4, 'folder', 8, 30),
(5, 'stapler', 2, 150),
(6, 'eraser', 12, 15),
(7, 'highlighter', 6, 50),
(8, 'ruler', 9, 25);

CREATE VIEW product_data AS
SELECT item, qty, price, qty * price AS value
FROM Products;

SELECT * FROM product_data;
SELECT * FROM product_data WHERE qty = 5;
DROP VIEW product_data;
"""

    capture = asyncio.run(
        capture_sql(
            code=sql,
            objective="Execute SQL Joins and Views on MySQL",
        )
    )
    assert capture.success is True, f"Capture failed: {capture.error}"
    assert capture.verification["dialect"] == "mysql"
    assert capture.verification["verified"] is True

    frames = capture.verification["evidence_frames"]
    source_frames = [f for f in frames if f["kind"] == "source_preview"]
    result_frames = [f for f in frames if f["kind"] == "database"]

    # Check source code pagination has no gaps or overlaps
    total_lines = len(sql.splitlines())
    assert len(source_frames) >= 4
    expected_start = 1
    for sf in source_frames:
        s_start, s_end = sf["source_ranges"][0]
        assert s_start == expected_start
        assert s_end >= s_start
        expected_start = s_end + 1
    assert expected_start - 1 == total_lines

    # Check 7 SELECT queries + 1 final DROP VIEW step = 8 result frames
    assert len(result_frames) == 8

    # Check every generated screenshot exists and is 1440x900
    for f in frames:
        assert os.path.isfile(f["path"])
        with Image.open(f["path"]) as img:
            assert img.size == (1440, 900)
