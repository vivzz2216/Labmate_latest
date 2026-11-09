import pytest
import os
from PIL import Image
from app.services.screenshot_service import screenshot_service

@pytest.mark.asyncio
async def test_sql_workbench_screenshot_capture():
    sql = """CREATE TABLE Students (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50),
  marks DECIMAL(5,2)
);
INSERT INTO Students VALUES (1, 'Amit', 85.00), (2, 'Neha', 95.00);
SELECT * FROM Students WHERE marks >= 90;"""

    success, path, width, height = await screenshot_service.generate_screenshot(
        code=sql,
        output="",
        theme="sql",
        filename="students.sql"
    )

    assert success is True, "Screenshot generation should succeed"
    assert os.path.isfile(path), f"Screenshot file should exist at {path}"
    assert width == 1440, f"Expected width 1440, got {width}"
    assert height == 900, f"Expected height 900, got {height}"

    with Image.open(path) as img:
        assert img.width == 1440
        assert img.height == 900

    # Clean up
    if os.path.exists(path):
        os.remove(path)


@pytest.mark.asyncio
async def test_sql_code_pages_and_steps_show_matching_result_grid_tables():
    from app.services.lab_capture import capture_sql

    sql = """-- ============================================================
-- Experiment 5: Complex Queries (GROUP BY, HAVING, Subqueries)
-- ============================================================

CREATE DATABASE IF NOT EXISTS `exp5_db`;
USE `exp5_db`;

-- ------------------------------------------------------------
-- Customers table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Customers` (
    `CustomerID` INT AUTO_INCREMENT PRIMARY KEY,
    `CustomerName` VARCHAR(100) NOT NULL,
    `PostalCode` VARCHAR(20) NOT NULL
);

INSERT INTO `Customers` (`CustomerName`, `PostalCode`) VALUES
('Alice',   '10001'),
('Bob',     '10001'),
('Charlie', '10002'),
('David',   '10002'),
('Eve',     '10002'),
('Frank',   '10003'),
('Grace',   '10004'),
('Heidi',   '10004'),
('Ivan',    '10005'),
('Judy',    '10005');

SELECT * FROM `Customers`;

-- ------------------------------------------------------------
-- Products table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Products` (
    `ProductID` INT AUTO_INCREMENT PRIMARY KEY,
    `ProductName` VARCHAR(100) NOT NULL,
    `Price` DECIMAL(10,2) NOT NULL
);

INSERT INTO `Products` (`ProductName`, `Price`) VALUES
('Widget',      25.50),
('Gadget',      40.00),
('Doohickey',   15.75),
('Thingamajig', 60.20),
('Contraption', 33.33),
('Apparatus',   22.10),
('Device',      55.55),
('Instrument',  48.80),
('Machine',     70.00),
('Tool',        18.90);

SELECT * FROM `Products`;

-- ------------------------------------------------------------
-- OrderDetails table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `OrderDetails` (
    `OrderID` INT AUTO_INCREMENT PRIMARY KEY,
    `ProductID` INT NOT NULL,
    `Quantity` INT NOT NULL,
    FOREIGN KEY (`ProductID`) REFERENCES `Products`(`ProductID`)
);

INSERT INTO `OrderDetails` (`ProductID`, `Quantity`) VALUES
(1,  5),
(2, 12),
(3,  8),
(4,  3),
(5,  7),
(6,  9),
(7, 14),
(8,  2),
(9,  6),
(10, 0);

SELECT * FROM `OrderDetails`;

SELECT c.`PostalCode`, COUNT(*) AS `customer_count`
FROM `Customers` c
GROUP BY c.`PostalCode`
ORDER BY `customer_count` DESC, c.`PostalCode` ASC;

SELECT p.`ProductName`, SUM(od.`Quantity`) AS `total_ordered`
FROM `OrderDetails` od
JOIN `Products` p ON od.`ProductID` = p.`ProductID`
GROUP BY p.`ProductID`, p.`ProductName`
HAVING SUM(od.`Quantity`) >= 10
ORDER BY `total_ordered` DESC;

SELECT `ProductID`, `ProductName`, `Price`
FROM `Products`
WHERE `Price` > (SELECT AVG(`Price`) FROM `Products`)
ORDER BY `Price` DESC;

SELECT COUNT(*) AS `total_orders`,
       AVG(`Quantity`) AS `average_quantity`,
       SUM(`Quantity`) AS `total_quantity`,
       MAX(`Quantity`) AS `max_quantity`,
       MIN(`Quantity`) AS `min_quantity`
FROM `OrderDetails`;"""

    capture = await capture_sql(
        code=sql,
        filename="exp5_complex_queries_group.sql",
        objective="Perform complex queries using GROUP BY, HAVING and nested queries.",
    )
    assert capture.success is True, f"Capture failed: {capture.error}"
    frames = capture.verification["evidence_frames"]
    source_frames = [f for f in frames if f["kind"] == "source_preview"]
    db_frames = [f for f in frames if f["kind"] == "database"]

    # Page 2 (Lines 23-44) contains SELECT * FROM Customers;
    page2 = next(f for f in source_frames if f.get('result_complete') and f.get('active_result_table')=='Customers')
    assert page2.get("active_result_table") == "Customers"
    assert page2.get("active_result_columns") == ["CustomerID", "CustomerName", "PostalCode"]
    assert len(page2.get("active_result_rows") or []) == 10

    # Page 3 (Lines 45-66) contains SELECT * FROM Products; -> MUST show Products, NOT total_quantity=66
    page3 = next(f for f in source_frames if f.get('result_complete') and f.get('active_result_table')=='Products')
    assert page3.get("active_result_table") == "Products"
    assert page3.get("active_result_columns") == ["ProductID", "ProductName", "Price"]
    assert len(page3.get("active_result_rows") or []) == 10
    assert page3["active_result_rows"][0]["ProductName"] == "Widget"
    assert page3["active_result_rows"][-1]["ProductName"] == "Tool"

    # Page 4 (Lines 67-88) contains SELECT * FROM OrderDetails;
    page4 = next(f for f in source_frames if f.get('result_complete') and f.get('active_result_table')=='OrderDetails')
    assert page4.get("active_result_table") == "OrderDetails"
    assert page4.get("active_result_columns") == ["OrderID", "ProductID", "Quantity"]
    assert len(page4.get("active_result_rows") or []) == 10

    # Only SELECT produces a new result grid; future SELECT rows must never
    # appear during CREATE/INSERT, even when the same table is queried later.
    for df in db_frames:
        if df.get('phase') == 'command':
            continue
        index=df['statement_index']
        selects=[s for s in capture.verification['statements'] if s['index']<=index and s.get('type')=='SELECT' and s.get('success') and s.get('columns')]
        assert df.get('active_result_rows',[]) == (selects[-1]['rows'][:12] if selects else [])
        assert df.get('active_result_columns',[]) == (selects[-1]['columns'] if selects else [])
