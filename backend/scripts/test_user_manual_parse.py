import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.parser_service import ParserService

async def main():
    file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "Python_Functions_Laboratory_Manual.docx"))
    print(f"Testing manual: {file_path}")
    parser = ParserService()
    tasks = await parser.parse_file(file_path, "docx")
    print(f"Extracted tasks count: {len(tasks)}")
    for i, t in enumerate(tasks):
        print(f"--- Task {i+1} ---")
        print(f"Question text:\n{t.get('question_text')}")
        print(f"Code snippet present: {bool(t.get('code_snippet'))}")

if __name__ == "__main__":
    asyncio.run(main())
