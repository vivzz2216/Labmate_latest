import sys, os, re, docx
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.services.parser_service import ParserService
from app.services.lab_question_filter import filter_lab_tasks

doc = docx.Document(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
lines = [p.text for p in doc.paragraphs if p.text.strip()]

SECTION = re.compile(
    r'^\s*(?:\d+[.)]\s*)?(?:'
    r'theory(?:\s*&\s*viva)?|theoretical\s+concepts?|objectives?|outcomes?|'
    r'expected\s+learning\s+outcomes?|viva(?:\s*voce)?|concepts?|review\s+questions|'
    r'pre[- ]?lab\s+questions|examples?|suggested\s+(?:post[- ]?experiment\s+)?programs?|'
    r'results?|conclusion|references?|hardware\s+requirements?|software\s+requirements?|'
    r'apparatus|equipment|precautions?|procedure'
    r')\b(?:\s*(?:questions?|section|programs?))?(?:\s*[:.-].*)?\s*$',
    re.I
)

LAB_HEADING = re.compile(
    r'^\s*(?:(?:\d+|[ivxlcdm]+|[a-z])\s*[-.)]\s*)?(?:'
    r'(?:post[- ]?(?:experiment|lab)\s*(?:[/&]\s*)?)?'
    r'(?:lab(?:oratory)?\s+(?:exercise|assignment|tasks?|questions?)|programming\s+(?:tasks?|questions?)|practical\s+exercises?|exercise|program|problem|aim)|'
    r'task\s*\d+'
    r')\b',
    re.I
)

excluded = False
kept = []
for i, line in enumerate(lines):
    stripped = line.strip()
    if SECTION.match(stripped):
        excluded = True
        continue
    if LAB_HEADING.match(stripped):
        excluded = False
    if not excluded:
        kept.append(stripped)

parser = ParserService()
tasks = parser._extract_tasks_from_lines(kept)
filtered = filter_lab_tasks(tasks)
print(f"Total tasks extracted: {len(filtered)}")
for idx, t in enumerate(filtered):
    print(f"  {idx+1}: {t.get('question_text', '')[:90]}")
