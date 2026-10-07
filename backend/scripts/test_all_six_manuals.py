import sys, os, re, docx
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Updated SECTION and LAB_HEADING definitions to test
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
    r'(?:lab(?:oratory)?\s+(?:exercises?|assignments?|tasks?|questions?)|programming\s+(?:tasks?|questions?)|practical\s+exercises?|exercises?|programs?|problem|aim)|'
    r'task\s*\d+'
    r')\b',
    re.I
)

def test_manual(file_path):
    doc = docx.Document(file_path)
    lines = [p.text for p in doc.paragraphs if p.text.strip()]
    
    excluded = False
    kept = []
    for line in lines:
        stripped = line.strip()
        if SECTION.match(stripped):
            excluded = True
            continue
        if LAB_HEADING.match(stripped):
            excluded = False
        if not excluded:
            kept.append(stripped)
            
    from app.services.parser_service import ParserService
    from app.services.lab_question_filter import filter_lab_tasks
    parser = ParserService()
    tasks = parser._extract_tasks_from_lines(kept)
    filtered = filter_lab_tasks(tasks)
    return len(filtered), filtered

manuals = [
    ("../sample_lab_manuals/python_lab_manual.docx", "Python Sample", 2),
    ("../sample_lab_manuals/java_lab_manual.docx", "Java Sample", 2),
    ("../sample_lab_manuals/c_lab_manual.docx", "C Sample", 2),
    ("../sample_lab_manuals/cpp_lab_manual.docx", "C++ Sample", 2),
    ("../sample_lab_manuals/webdev_lab_manual.docx", "WebDev Sample", 2),
    ("../../Python_Functions_Laboratory_Manual.docx", "User Python Functions Manual", 10),
]

all_passed = True
for rel_path, name, expected in manuals:
    full_path = os.path.abspath(os.path.join(os.path.dirname(__file__), rel_path))
    count, tasks = test_manual(full_path)
    status = "PASS" if count == expected else "FAIL"
    if status == "FAIL":
        all_passed = False
    print(f"[{status}] {name}: expected {expected}, extracted {count}")
    for idx, t in enumerate(tasks):
        print(f"   Task {idx+1}: {t.get('question_text', '')[:70]}")

print("\nOVERALL STATUS:", "ALL PASSED" if all_passed else "SOME FAILED")
