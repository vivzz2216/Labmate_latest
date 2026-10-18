"""Create audit-owned manuals. Run with the document/PDF-capable Python runtime."""
from pathlib import Path
from xml.sax.saxutils import escape

from docx import Document
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak


MIXED = [
    ('Experiment 1 C input and output', 'Write a C program that reads 2 and 3 and prints their sum.', 'Expected output: 5'),
    ('Experiment 2 Python functions', 'Write a Python program that defines a square function and prints square of 6.', 'Expected output: 36'),
    ('Experiment 3 Browser modal', 'Create an HTML JavaScript page with an Open button that opens a dialog showing Lab result.', 'Capture the dialog after clicking Open.'),
]
GUI = [
    ('Experiment 1 Swing calculator', 'Create a Java Swing calculator with two number fields and an Add button.', 'Capture the real calculator window and 2 plus 3 giving 5.'),
    ('Experiment 2 Tkinter form', 'Create a Python Tkinter login form with input validation.', 'Capture invalid input and the successful login window.'),
    ('Experiment 3 Flask form', 'Build a Python Flask application with a registration form and server validation.', 'Test homepage, validation, and successful form submission.'),
]


def create(root):
    root.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    for name, experiments in [('manual_mixed', MIXED), ('manual_gui', GUI)]:
        blocks = []
        for index, experiment in enumerate(experiments):
            if index: blocks.append(PageBreak())
            for number, text in enumerate(experiment):
                blocks.extend([Paragraph(escape(text), styles['Heading1' if number == 0 else 'BodyText']), Spacer(1, 14)])
        SimpleDocTemplate(str(root / (name + '.pdf'))).build(blocks)
    doc = Document()
    for experiment in MIXED:
        for index, text in enumerate(experiment):
            doc.add_paragraph(text, 'Heading 1' if index == 0 else None)
    doc.save(root / 'manual_mixed.docx')


if __name__ == '__main__':
    create(Path(__file__).resolve().parents[1] / 'audit_artifacts' / 'manuals')
