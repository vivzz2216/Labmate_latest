import asyncio
import os
import sys

# Ensure backend package is in sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.parser_service import parser_service

async def test_manual(filepath, name):
    print(f"\n==========================================")
    print(f"Testing extraction on: {name}")
    print(f"Path: {filepath}")
    print(f"==========================================")
    
    tasks = await parser_service.parse_file(filepath, "docx")
    print(f"Total tasks extracted: {len(tasks)}")
    for i, t in enumerate(tasks, 1):
        q = t.get("question_text", "").replace("\n", " ")
        lang = t.get("detected_language")
        print(f"  Task {i} [{lang}]: {q[:100]}...")
    
    # Check if any theory questions leaked into tasks
    theory_keywords = ["explain", "differentiate", "what is", "why is", "describe", "jvm", "gil"]
    theory_leaks = []
    for t in tasks:
        q_lower = t.get("question_text", "").lower()
        if any(kw in q_lower for kw in theory_keywords) and not ("write a" in q_lower or "program" in q_lower):
            theory_leaks.append(t)
            
    if theory_leaks:
        print(f"  [FAIL] WARNING: {len(theory_leaks)} potential theory questions were mistakenly extracted!")
    else:
        print(f"  [PASS] SUCCESS: Only programming/lab exercises extracted. Zero theory leakage.")
        
    return tasks

async def main():
    base_dir = os.path.join(os.path.dirname(__file__), "..", "sample_lab_manuals")
    if not os.path.exists(base_dir):
        base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sample_lab_manuals")
    files = [
        ("Python Lab", os.path.join(base_dir, "python_lab_manual.docx")),
        ("Java Lab", os.path.join(base_dir, "java_lab_manual.docx")),
        ("C Lab", os.path.join(base_dir, "c_lab_manual.docx")),
        ("C++ Lab", os.path.join(base_dir, "cpp_lab_manual.docx")),
        ("Web Dev Lab", os.path.join(base_dir, "webdev_lab_manual.docx")),
    ]
    
    for name, path in files:
        await test_manual(path, name)

if __name__ == "__main__":
    asyncio.run(main())
