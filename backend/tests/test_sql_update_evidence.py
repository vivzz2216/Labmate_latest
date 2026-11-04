import asyncio
import re

import pytest

from app.services.lab_capture import capture_sql


@pytest.mark.asyncio
async def test_mysql_update_has_before_update_and_after_update_frames():
    sql = """CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(30), age INT);
INSERT INTO students VALUES (1, 'Bob', 21);
SELECT * FROM students WHERE name = 'Bob';
UPDATE students SET age = 22 WHERE name = 'Bob';
SELECT * FROM students WHERE name = 'Bob';
DROP TABLE students;"""
    result = await capture_sql(sql, filename='students_update.sql', objective='Update a MySQL student age and show the value before and after updating.')
    assert result.success, result.error
    frames = result.verification['evidence_frames']
    captions = [frame.get('caption', '') for frame in frames]
    before = next(frame for frame in frames if 'Before UPDATE' in frame.get('caption', ''))
    during = next(frame for frame in frames if 'MySQL Workbench UPDATE' in frame.get('caption', ''))
    after = next(frame for frame in frames if 'After UPDATE' in frame.get('caption', ''))
    assert before['statement'].lstrip().upper().startswith('SELECT')
    assert during['statement'].lstrip().upper().startswith('UPDATE')
    assert 'last SELECT before this update' in during['caption']
    assert after['statement'].lstrip().upper().startswith('SELECT')
    statements = result.verification['statements']
    observed = [s for s in statements if s.get('type') == 'SELECT' and s.get('success')]
    assert observed[0]['rows'][0]['age'] == 21
    assert observed[1]['rows'][0]['age'] == 22
    assert all(frame.get('path') for frame in (before, during, after))
