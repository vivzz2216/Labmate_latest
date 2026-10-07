import docx
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.parser_service import ParserService
from app.services.lab_question_filter import programming_lines, filter_lab_tasks, SECTION

file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
doc = docx.Document(file_path)

from docx.table import Table
from docx.text.paragraph import Paragraph

lines = []
for child in doc.element.body.iterchildren():
    if child.tag.endswith('}p'):
        lines.extend(Paragraph(child, doc).text.splitlines())
    elif child.tag.endswith('}tbl'):
        table = Table(child, doc)
        for row in table.rows:
            for cell in row.cells:
                lines.extend(cell.text.splitlines())

print(f"Total raw lines: {len(lines)}")
p_lines = programming_lines(lines)
print(f"Lines after programming_lines(): {len(p_lines)}")

# Let's inspect where lines were dropped or kept
parser = ParserService()
tasks = parser._extract_tasks_from_lines(lines)
print(f"parser._extract_tasks_from_lines(lines) raw tasks: {len(tasks)}")
for i, t in enumerate(tasks):
    print(f"Task {i+1}: {repr(t.get('question_text', ''))[:100]}")

filtered = filter_lab_tasks(tasks)
print(f"After filter_lab_tasks: {len(filtered)}")
