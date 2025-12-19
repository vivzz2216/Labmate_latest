import re
import json
import textwrap
from typing import Any, Dict, List, Optional
import logging

import pdfplumber
from docx import Document
from ..config import settings

try:
    import openai
    OPENAI_AVAILABLE = bool(settings.OPENAI_API_KEY)
except ImportError:
    OPENAI_AVAILABLE = False
except Exception:
    OPENAI_AVAILABLE = False

logger = logging.getLogger(__name__)

LAB_EXTRACTION_PROMPT = """
You are an expert lab-manual parser. Read the ENTIRE lab manual like a human and extract ONLY real programming questions as tasks.

⚠️ CRITICAL: EXTRACT EVERY SINGLE QUESTION ⚠️
- Count ALL numbered questions (1, 2, 3... Q1, Q2, Q3... Program 1, Program 2...)
- Extract EVERY "Write a program..." statement as a separate task
- Extract EVERY "Question:" or "Problem:" section
- DO NOT skip any questions - if the manual has 10 questions, extract ALL 10
- If you see numbered questions (1., 2., 3., etc.), each number is a SEPARATE task
- Verify your count matches the manual's question count

============================
INTELLIGENT GROUPING RULES
============================

1. Treat any section starting with these as a SINGLE task block:
   - "Aim:" or "Aim"
   - "Experiment –" or "Experiment:"
   - "Program:" or "Program"
   - "Write a program…"
   - "Problem:" or "Problem"
   - "Question:" or "Question"
   - "Lab Exercise" or "Lab Exercise:"
   - "Post-Experiment Exercise" or "Post Lab Exercise"
   - "Q1" / "Q2" / "Program 1" / "Program 2" (only if clearly separate)

2. CRITICAL GROUPING RULE: All bullet points, sub-points, and multiline descriptions under that block MUST be grouped into ONE task.
   - If an Aim has bullet points (●Create class, ●Print name, ●Update salary), they ALL belong to ONE task
   - If a section has sub-points (i), ii), iii)), they ALL belong to ONE task UNLESS explicitly numbered as separate questions
   - Never split these lines into multiple tasks

3. If a section contains multiple requirements (e.g., create class, update salary, derive subclasses), assume they ALL belong to ONE program question.

4. ⚠️ NUMBERED QUESTIONS ARE SEPARATE TASKS ⚠️
   - "1. Write a program..." → Task 1
   - "2. Write a program..." → Task 2
   - "3. Write a program..." → Task 3
   - Each numbered question (1., 2., 3., Q1, Q2, Q3, Program 1, Program 2, etc.) is a SEPARATE task
   - Only create multiple tasks if the manual explicitly separates them with:
     * Clearly numbered questions (Q1, Q2, Q3… on separate lines)
     * Separate "Write a program…" statements (each on its own line/section)
     * Separate "Questions/Programs" lists with distinct numbering
     * Clearly independent problems (not sub-points of the same problem)

5. IGNORE completely:
   - College info, headers, titles
   - Objectives, outcomes, prerequisites
   - Instructions to open IDE
   - Theory sections
   - Conclusion, references
   - Any non-program text

6. The final extracted task must include:
   - The full merged question block (all bullet points and sub-points combined)
   - ONE cohesive AI answer (editable)
   - A valid code solution that addresses ALL requirements in the grouped block

OUTPUT FORMAT:
Return tasks as JSON array:
[
  {
    "question_text": "<full grouped question with all bullet points and sub-points>",
    "code_snippet": "<complete executable Python code that addresses ALL requirements>",
    "requires_screenshot": true
  }
]

EXAMPLES:
- "Aim: Write a menu driven program to demonstrate OOP. ●Create class Employee ●Print name and salary ●Update salary ●Create Manager and Staff classes"
  → ONE task (all bullet points grouped)

- "1. Write a program to calculate factorial\n2. Write a program to find prime numbers\n3. Write a program to reverse a string"
  → THREE tasks (each numbered question is separate)

- "Aim: Demonstrate functions. i) Normal function ii) Recursive function iii) Lambda function"
  → ONE task (all sub-points grouped under one Aim)

IMPORTANT:
- Group intelligently like a human would read the manual
- Prevent over-splitting - when in doubt, group together
- ⚠️ BUT: Numbered questions (1., 2., 3., Q1, Q2, Q3) are ALWAYS separate tasks
- Return ONLY valid JSON array, no commentary
- If you find 0 tasks, return empty array []
- COUNT YOUR TASKS: If manual says "10 questions", ensure you extract exactly 10 tasks
"""

LAB_CODE_GENERATION_PROMPT = '''
You are a precise Python lab assistant. Generate COMPLETE, ERROR-FREE, executable Python code for ANY Python concept.

⚠️ MANDATORY PICKLE RULE (IGNORE THIS = CODE WILL CRASH) ⚠️
When using pickle.load() in a while True loop:
- ALWAYS use isinstance() to check if the loaded object is a list or single object
- Pattern: obj = pickle.load(file); if isinstance(obj, list): for item in obj: item.method() else: obj.method()
- NEVER write: student = pickle.load(file); student.display() ← THIS WILL CRASH IF student IS A LIST!
- The pickle file might contain [list, object, object...] so the FIRST load could be a list!

=== COMPREHENSIVE PYTHON COVERAGE ===
Your code MUST handle ALL these topics flawlessly:

1. BASICS: Syntax, indentation, variables, data types (int/float/str/bool), type casting, operators (arithmetic/logical/bitwise), input/output, comments, docstrings
2. DATA STRUCTURES: Lists, tuples, sets, dicts, strings, slicing, iteration, comprehensions, mutability vs immutability
3. CONTROL FLOW: if/elif/else, for/while loops, break/continue/pass, try/except/else/finally exception handling
4. FUNCTIONS: def, return, parameters, *args/**kwargs, lambda, higher-order functions, closures, decorators (function & class-based)
5. MODULES: import, from import, creating modules/packages, __init__.py, pip, virtual environments
6. FILE HANDLING: open() with r/w/a/rb/wb modes, reading/writing text, CSV (csv module), JSON (json module), pathlib, file exceptions
7. OOP: Classes, __init__, attributes/methods, class vs instance variables, encapsulation, inheritance, multiple inheritance, polymorphism, method overriding, abstract classes (ABC), protocols, dataclasses

=== CRITICAL REQUIREMENTS ===
1. If manual provides code, copy it verbatim. If incomplete, complete it with ALL necessary components.
2. If manual provides instructions only, produce COMPLETE, self-contained implementation:
   - Include ALL base classes if inheritance is involved
   - Include ALL necessary imports (csv, json, pathlib, abc, dataclasses, etc.)
   - Include ALL methods and attributes
   - Include example usage with print statements
   - Make code substantial (15-30+ lines minimum)

3. SPECIFIC RULES BY TOPIC:
   
   A. OOP/INHERITANCE:
      * Define base class(es) with proper __init__, __str__/__repr__
      * CRITICAL: Child class __init__ MUST call super().__init__() with base class parameters
      * Example: Manager(Employee) → super().__init__(emp_id, name, dept, salary)
      * Support abstract classes: from abc import ABC, abstractmethod
      * Support dataclasses: from dataclasses import dataclass
      * NEVER forget super().__init__() - this is mandatory
   
   B. FILE OPERATIONS:
      * For CSV: import csv, use csv.reader/csv.writer
      * For JSON: import json, use json.load/json.dump
      * For pathlib: from pathlib import Path
      * For pickle: import pickle, use pickle.load/pickle.dump
      * CRITICAL PICKLE RULES (MOST COMMON ERROR SOURCE):
        - pickle.load() can return EITHER a single object OR a list - you MUST check the type!
        - When reading from pickle files in a while True loop, ALWAYS use isinstance() to check type
        - Pattern: `obj = pickle.load(file); if isinstance(obj, list): for item in obj: item.method() else: obj.method()`
        - NEVER assume pickle.load() returns a single object - it could be a list!
        - NEVER call methods directly on pickle.load() result without type checking
        - Correct: `obj = pickle.load(f); if isinstance(obj, list): for s in obj: s.display() else: obj.display()`
        - WRONG: `student = pickle.load(file); student.display()` (will crash if student is actually a list!)
        - WRONG: `while True: student = pickle.load(f); student.display()` (no type checking!)
        - The file might contain: [list][object][object]... so FIRST load could be a list!
   
   C. DECORATORS:
      * Function decorators: def decorator(func): def wrapper(*args, **kwargs): ... return wrapper
      * Class decorators: def class_decorator(cls): ... return cls
      * Include @decorator syntax and demonstration
   
   D. EXCEPTION HANDLING:
      * Use try/except/else/finally correctly
      * Catch specific exceptions (FileNotFoundError, ValueError, etc.)
      * Include proper error messages
   
   E. COMPREHENSIONS:
      * List: [x for x in range(10)]
      * Dict: {k: v for k, v in items}
      * Set: {x for x in range(10)}
   
   F. LAMBDA & HIGHER-ORDER:
      * Lambda: lambda x: x * 2
      * map, filter, reduce examples
      * Functions as arguments

4. IMPORTS: Include ALL necessary imports at the top:
   - Standard library: csv, json, os, pathlib, abc, dataclasses, typing, etc.
   - NEVER assume imports - explicitly include them

5. OUTPUT: ALWAYS include print statements to display results. If code creates variables, data structures, or objects, PRINT them.

6. COMPLETENESS: Code must run top-to-bottom when pasted into a .py file. NO placeholders, NO missing dependencies, NO ERRORS.

7. FORMAT: Output plain Python text with no markdown fences or commentary.

=== ZERO-ERROR GUARANTEE ===
- Test all code paths mentally before generating
- Ensure all imports are included
- Verify inheritance chains have super().__init__()
- Check file operations have proper modes
- ⚠️ CRITICAL: For pickle.load() in while True loops, ALWAYS add isinstance() check BEFORE calling methods
- Confirm list iterations don't call methods on lists
- Validate exception handling is complete
- Ensure dataclasses have @dataclass decorator
- Verify abstract classes use ABC and @abstractmethod

=== EXAMPLES OF CORRECT PATTERNS ===
```
# Inheritance with super()
class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary

class Manager(Employee):
    def __init__(self, name, salary, team_size):
        super().__init__(name, salary)  # CRITICAL!
        self.team_size = team_size

# File handling with CSV
import csv
with open('data.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Name', 'Age'])

# Pickle with proper list iteration - CRITICAL PATTERN
import pickle

class Student:
    def __init__(self, name, age):
        self.name = name
        self.age = age
    def display(self):
        print(f"Name: {self.name}, Age: {self.age}")

def write_to_file(student):
    with open('student_data.pkl', 'ab') as file:
        pickle.dump(student, file)

def read_from_file():
    """CRITICAL: pickle.load() can return EITHER a single object OR a list!
    You MUST check the type before calling methods."""
    try:
        with open('student_data.pkl', 'rb') as file:
            while True:
                try:
                    obj = pickle.load(file)
                    
                    # CRITICAL: Check if obj is a list or single object
                    if isinstance(obj, list):
                        # If it's a list, iterate through it
                        for student in obj:
                            student.display()
                    else:
                        # If it's a single object, call method directly
                        obj.display()
                        
                except EOFError:
                    break
    except FileNotFoundError:
        print('No data file found.')

# CORRECT usage
if __name__ == '__main__':
    # Write students
    s1 = Student('John Doe', 20)
    write_to_file(s1)
    
    # Read students (handles both list and single objects)
    print('Students in file:')
    read_from_file()

# Decorator
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("Before")
        result = func(*args, **kwargs)
        print("After")
        return result
    return wrapper

@my_decorator
def greet(name):
    print(f"Hello, {name}")

# Abstract class
from abc import ABC, abstractmethod
class Shape(ABC):
    @abstractmethod
    def area(self):
        pass

# Dataclass
from dataclasses import dataclass
@dataclass
class Point:
    x: int
    y: int
```

Generate code that handles ANY of these topics without errors!
'''


class ParserService:
    """Parse lab manuals and return only the executable programming tasks."""

    def __init__(self) -> None:
        self.program_keywords = [
            "write a program",
            "python program",
            "program to",
            "code to",
            "algorithm to",
            "implement",
            "simulate",
            "generate",
            "develop",
            "pattern",
            "loop",
            "recursion",
            "function",
            "fibonacci",
            "factorial",
            "prime",
            "list",
            "dictionary",
            "array",
            "search",
            "sort",
            "stack",
            "queue",
            "reverse",
        ]
        self.ignore_section_keywords = [
            "objective",
            "objectives",
            "outcome",
            "outcomes",
            "apparatus",
            "equipment",
            "theory",
            "introduction",
            "procedure",
            "observation",
            "result",
            "results",
            "precaution",
            "prerequisite",
            "reference",
            "references",
            "conclusion",
            "discussion",
            "certificate",
            "acknowledgement",
            "acknowledgment",
        ]
        self.post_lab_section_keywords = [
            "post lab",
            "post-lab",
            "post experiment",
            "post-experiment",
            "programs",
            "programming questions",
            "lab exercises",
            "practice questions",
            "review questions",
            "questions/programs",
            "exercise",
        ]
        self.section_stop_keywords = [
            "result",
            "results",
            "references",
            "conclusion",
            "documentation",
            "viva",
            "further study",
        ]
        self.question_patterns = [
            r"^\d+[\.\)]",
            r"^\(\d+\)",
            r"^[A-Za-z]\)",
            r"^\(?[ivxlcdmIVXLCDM]+\)",
            r"^[IVXLCDM]+\.",
            r"^Q(?:uestion)?\s*\d+",
            r"^Experiment\s*\d+",
            r"^Program\s*\d+",
            r"^Lab\s*Experiment\s*\d+",
        ]
        self.code_indicators = [
            "#include",
            "public static void main",
            "System.out.println",
            "printf(",
            "scanf(",
            "cin >>",
            "cout <<",
            "int main(",
            "class ",
            "interface ",
            "using namespace",
            "document.write",
            "<html",
            "</html>",
            "<body",
            "</body>",
            "function ",
            "const ",
            "let ",
            "var ",
            "console.log",
            "Scanner(",
            "import java.",
        ]
        
        # Initialize OpenAI client if available
        self.openai_client = None
        if OPENAI_AVAILABLE and settings.OPENAI_API_KEY:
            try:
                openai.api_key = settings.OPENAI_API_KEY
                self.openai_client = openai
                self.openai_model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI: {e}")
                self.openai_client = None
    
    async def parse_file(self, file_path: str, file_type: str) -> List[Dict[str, Any]]:
        file_type = file_type.lower()
        if file_type == "docx":
            return await self._parse_docx(file_path)
        if file_type == "pdf":
            return await self._parse_pdf(file_path)
            raise ValueError(f"Unsupported file type: {file_type}")
    
    async def _parse_docx(self, file_path: str) -> List[Dict[str, Any]]:
        doc = Document(file_path)
        lines = [paragraph.text.strip() for paragraph in doc.paragraphs if paragraph.text]
        return self._extract_tasks_from_lines(lines)
    
    async def _parse_pdf(self, file_path: str) -> List[Dict[str, Any]]:
        lines: List[str] = []
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue
                for raw_line in text.split("\n"):
                    cleaned = raw_line.strip()
                    if cleaned:
                        lines.append(cleaned)
        return self._extract_tasks_from_lines(lines)

    def _extract_tasks_from_lines(self, lines: List[str]) -> List[Dict[str, Any]]:
        # First try precise AI-based extraction when OpenAI is available
        ai_tasks = self._extract_tasks_with_openai(lines)
        if ai_tasks:
            return self._assign_task_ids(ai_tasks)

        tasks: List[Dict[str, Any]] = []
        current_task: Optional[Dict[str, Any]] = None
        skip_block = False
        in_post_lab_section = False

        for idx, raw_line in enumerate(lines):
            line = raw_line.strip()
            original_line = raw_line  # Keep original for indentation checks
            
            # Check for markdown code fences
            is_code_fence_start = line.startswith("```")
            is_code_fence_end = line == "```" or line.startswith("```")
            
            if not line:
                if skip_block:
                    skip_block = False
                # Continue collecting code if we're in a code block (empty lines are part of code)
                if current_task and current_task.get("collecting_code", False):
                    current_task["code_lines"].append("")
                continue

            lower_line = line.lower()
            
            # Handle code fence markers
            if current_task and current_task.get("in_code_fence", False):
                if is_code_fence_end:
                    # End of code fence
                    current_task["in_code_fence"] = False
                    current_task["collecting_code"] = False
                    continue
                else:
                    # Still in code fence - collect all lines
                    current_task["code_lines"].append(original_line)
                    continue
            elif is_code_fence_start:
                # Start of code fence
                if current_task:
                    current_task["in_code_fence"] = True
                    current_task["collecting_code"] = True
                    # Don't add the fence marker itself
                    continue

            if self._starts_post_lab_section(lower_line):
                in_post_lab_section = True
                skip_block = False
                continue

            if in_post_lab_section and self._is_section_terminator(lower_line):
                in_post_lab_section = False
                continue

            if self._should_skip_line(lower_line, line):
                skip_block = True
                continue

            if skip_block:
                        continue
                    
            # Check if this starts a new task block (Aim, Experiment, Program, etc.)
            starts_task_block = (
                lower_line.startswith("aim") or
                lower_line.startswith("experiment") or
                lower_line.startswith("program:") or
                lower_line.startswith("problem:") or
                lower_line.startswith("question:") or
                self._is_program_prompt(line) or
                (in_post_lab_section and self._looks_like_enumerated_prompt(line))
            )

            # Check if this is a clearly separate numbered question
            is_separate_question = self._is_separate_numbered_question(line)

            if starts_task_block or is_separate_question:
                # Finalize previous task if exists
                if current_task:
                    tasks.append(self._finalize_task(current_task))
                
                # Start new task
                if lower_line.startswith("aim"):
                    current_task = self._build_aim_task(line)
                elif in_post_lab_section and self._looks_like_enumerated_prompt(line):
                    current_task = self._build_prompt_task(line)
                else:
                    current_task = self._initialize_task(line)
                continue

            # If we have a current task, collect all related content (bullet points, sub-points, etc.)
            if current_task:
                # Collect bullet points, sub-points, and related content
                is_bullet_point = (
                    line.startswith("●") or line.startswith("•") or 
                    line.startswith("-") or line.startswith("*") or
                    re.match(r'^[a-z]\)', lower_line) or  # i), ii), iii)
                    re.match(r'^\d+[\.\)]', line)  # 1., 2., 1), 2) (but not separate questions)
                )
                
                # Check if this line is code
                is_code_line = self._is_code(line)
                is_indented = original_line.startswith(("    ", "\t"))  # Check original line for indentation
                
                # Don't start collecting code if line is only a closing brace (incomplete code)
                # Instead, try to look backwards for actual code
                if not current_task.get("collecting_code", False):
                    if line.strip() in ["}", "};"] and len(line.strip()) <= 3:
                        # This is just a closing brace - don't start code collection on this alone
                        # Try to look backwards for actual code (up to 20 lines back)
                        potential_code_start = None
                        for i in range(max(0, idx - 20), idx):
                            if i < len(lines):
                                prev_raw = lines[i]
                                prev_line = prev_raw.strip()
                                if prev_line and prev_line not in ["}", "};"]:
                                    # Check if this looks like start of code
                                    if (self._is_code(prev_line) or 
                                        prev_raw.startswith(("    ", "\t")) or
                                        prev_line.startswith(("#include", "public class", "class ", "int main", "void main", "def ", "import ", "function "))):
                                        potential_code_start = i
                                        break
                        
                        # If we found potential code start, collect from there
                        if potential_code_start is not None:
                            current_task["collecting_code"] = True
                            # Add all lines from potential start to current
                            for i in range(potential_code_start, idx + 1):
                                if i < len(lines):
                                    current_task["code_lines"].append(lines[i])
                            continue
                        else:
                            # No code found before - skip this closing brace (it's incomplete)
                            # The code will be generated in _finalize_task
                            continue
                
                # If we're already collecting code, continue until we hit a clear non-code section
                if current_task.get("collecting_code", False):
                    # Check if this looks like the end of a code block
                    # Stop if: non-code line that's not indented AND doesn't have code characters AND is a new question
                    if not is_code_line and not is_indented and not any(ch in line for ch in ["{", "}", ";", "(", ")"]):
                        # Check if it's a new question/task (this would start a new task)
                        if self._is_program_prompt(line) or self._is_separate_numbered_question(line) or starts_task_block:
                            # This is a new task, stop collecting code for current task
                            current_task["collecting_code"] = False
                            # Don't add this line to code, it's a new question
                        elif not is_bullet_point and not self._belongs_to_question(line):
                            # Not code, not a question continuation - might be end of code block
                            # Check next few lines to see if code continues
                            lookahead_lines = 2
                            code_continues = False
                            for i in range(1, min(lookahead_lines + 1, len(lines) - idx)):
                                if idx + i < len(lines):
                                    next_raw = lines[idx + i]
                                    next_line = next_raw.strip()
                                    if next_line and (self._is_code(next_line) or next_raw.startswith(("    ", "\t"))):
                                        code_continues = True
                                        break
                            
                            if not code_continues:
                                current_task["collecting_code"] = False
                                # Add to question text instead
                                if current_task.get("question_text"):
                                    current_task["question_text"] += " " + line
                                else:
                                    current_task["question_text"] = line
                                continue
                    
                    # Still collecting code - add this line
                    current_task["code_lines"].append(original_line)  # Use original_line to preserve indentation
                    continue
                elif is_code_line or is_indented:
                    # Start collecting code - this is the beginning of a code block
                    current_task["collecting_code"] = True
                    current_task["code_lines"].append(original_line)  # Use original_line to preserve indentation
                    continue
                elif is_bullet_point or self._belongs_to_question(line):
                    if current_task.get("question_text"):
                        current_task["question_text"] += " " + line
                    else:
                        current_task["question_text"] = line
                continue

        if current_task:
            tasks.append(self._finalize_task(current_task))

        return self._assign_task_ids(tasks)

    def _extract_tasks_with_openai(self, lines: List[str]) -> Optional[List[Dict[str, Any]]]:
        if not self.openai_client:
            return None

        document_text = "\n".join(lines)
        # Increase limit to capture more content (was 20000, now 50000)
        if len(document_text) > 50000:
            # Keep the entire document but prioritize the middle and end sections
            # (beginning often has headers, end often has questions)
            document_text = document_text[:10000] + "\n[... document continues ...]\n" + document_text[-40000:]

        try:
            # Count questions in the document to help AI
            question_count = len(re.findall(r'(?:^|\n)\s*(?:\d+[\.\)]|Q\d+|Question\s+\d+|Program\s+\d+)', document_text, re.MULTILINE | re.IGNORECASE))
            
            response = self.openai_client.ChatCompletion.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": LAB_EXTRACTION_PROMPT},
                    {"role": "user", "content": f"""Extract programming tasks from this lab manual using intelligent grouping rules:

⚠️ CRITICAL INSTRUCTIONS:
1. Extract EVERY SINGLE question - do not skip any
2. Numbered questions (1., 2., 3., Q1, Q2, Q3, Program 1, Program 2, etc.) are SEPARATE tasks
3. Each "Write a program..." statement is a separate task
4. Group bullet points under a single heading (Aim, Experiment) into ONE task
5. Ignore non-program content (objectives, theory, references)

I found approximately {question_count} numbered questions in the document. Please extract ALL of them.

Lab Manual Text:
{document_text}

⚠️ REMEMBER: 
- If the manual has numbered questions (1., 2., 3., etc.), extract EACH as a separate task
- Count your extracted tasks - they should match the number of questions in the manual
- Do NOT skip any questions - extract EVERY programming task you find
- Group intelligently but split numbered questions into separate tasks"""}
                ],
                max_tokens=8000,  # Increased significantly to handle 10+ questions
                temperature=0.1  # Lower temperature for more consistent extraction
            )
            raw_content = response.choices[0].message.content.strip()
            tasks_data = json.loads(raw_content)

            normalized_tasks: List[Dict[str, Any]] = []
            for idx, task in enumerate(tasks_data, start=1):
                question = (task.get("question_text") or "").strip()
                code = (task.get("code_snippet") or "").rstrip()
                requires_screenshot = bool(task.get("requires_screenshot", True))

                if not question or not code:
                    logger.warning(f"Skipping task {idx}: missing question or code")
                    continue

                # Detect language from code
                detected_language = self._detect_language_from_code(code)
                
                normalized_tasks.append(
                    {
                        "id": idx,
                        "question_text": question,
                        "code_snippet": code,
                        "requires_screenshot": requires_screenshot,
                        "ai_answer": task.get("ai_answer"),
                        "detected_language": detected_language,
                    }
                )

            # Log extraction results
            logger.info(f"OpenAI extraction: Found {question_count} numbered questions in document, extracted {len(normalized_tasks)} tasks")
            if question_count > 0 and len(normalized_tasks) < question_count:
                logger.warning(f"⚠️ POTENTIAL MISSING QUESTIONS: Document has ~{question_count} numbered questions but only {len(normalized_tasks)} tasks extracted!")
            
            if normalized_tasks:
                return normalized_tasks
        except json.JSONDecodeError as json_error:
            logger.error("Failed to decode OpenAI extraction response: %s", json_error)
        except Exception as e:
            logger.error("OpenAI extraction failed: %s", e)

        return None

    def _initialize_task(self, prompt: str) -> Dict[str, Any]:
        return {"question_text": self._clean_prompt_text(prompt), "code_lines": []}

    def _detect_language_from_code(self, code: str) -> Optional[str]:
        """Detect programming language from code snippet"""
        if not code:
            return None
        
        code_lower = code.lower()
        
        # Java detection
        java_indicators = [
            "public class", "public static void main", "system.out.println",
            "import java.", "scanner", "string[] args", "extends", "implements"
        ]
        if any(indicator in code_lower for indicator in java_indicators):
            return "java"
        
        # C detection
        c_indicators = [
            "#include", "int main(", "printf(", "scanf(", "#define",
            "void main(", "return 0;"
        ]
        if any(indicator in code_lower for indicator in c_indicators):
            return "c"

        # Node.js detection (do this BEFORE React/HTML: Node labs often embed HTML strings)
        node_indicators = [
            # CommonJS
            "require(", "module.exports", "exports.",
            # Express
            "express()", "app.listen", "app.get(", "app.post(", "app.use(",
            "const express", "require('express')", 'require("express")',
            "from 'express'", 'from "express"', "import express",
            # HTTP server
            "http.createserver", "https.createserver", "createServer(",
            # Node core modules and patterns
            "const http", "const fs", "fs.", "path.", "process.env", "__dirname",
            "res.writehead", "res.end(", "req.url",
        ]
        if any(indicator in code_lower for indicator in node_indicators):
            return "node"
        
        # React/JSX detection
        react_indicators = [
            "import react", "reactdom", "createroot", "jsx",
            "usestate", "useeffect", "usememo", "usecallback",
            "from 'react'", 'from "react"',
            "react-router", "browserrouter", "<routes", "<route", "classname=",
            "export default", "export function",
        ]
        if any(indicator in code_lower for indicator in react_indicators):
            return "react"
        
        # HTML detection
        html_indicators = [
            "<!doctype", "<html", "<head", "<body", "<title", "<meta", "<script", "<style"
        ]
        if any(indicator in code_lower for indicator in html_indicators):
            return "html"
        
        # Default to Python
        return "python"
    
    def _is_incomplete_code_block(self, code: str) -> bool:
        """Check if code block is incomplete (e.g., only closing braces)"""
        if not code:
            return True
        
        code_lines = [line.strip() for line in code.split('\n') if line.strip()]
        
        # If code is very short (1-3 lines) and only contains closing braces or minimal content
        if len(code_lines) <= 3:
            # Check if it's mostly just closing braces
            closing_braces_only = all(
                line in ['}', '};', '}', '});'] or 
                (line.startswith('}') and len(line) <= 3) or
                (line == '}' and not any(c.isalpha() for c in line))
                for line in code_lines
            )
            if closing_braces_only:
                return True
            
            # Check if there's no actual code structure (no includes, no class, no function, no main)
            has_structure = any(
                '#include' in line or
                'public class' in line or
                'class ' in line or
                'def ' in line or
                'int main' in line or
                'void main' in line or
                'function ' in line or
                'import ' in line
                for line in code_lines
            )
            if not has_structure:
                return True
        
        # Check if code starts with closing braces (definitely incomplete)
        first_line = code_lines[0] if code_lines else ""
        if first_line.strip() in ['}', '};']:
            return True
        
        return False
    
    def _extract_code_from_question_text(self, question_text: str) -> str:
        """Extract code blocks from question text that might contain embedded code"""
        if not question_text:
            return ""
        
        # First, try to find code blocks that start with clear markers
        code_start_markers = ["#include", "public class", "class ", "int main", "void main", "def ", "import ", "function ", "<!doctype", "<html", "void ", "int ", "float ", "double "]
        
        # Look for code that starts in the middle of a line (like "Program 1: ... #include...")
        # Split by common separators and find code blocks
        parts = re.split(r'[:\n]', question_text)
        code_blocks = []
        
        for part in parts:
            stripped = part.strip()
            if not stripped:
                continue
            
            # Check if this part contains code
            for marker in code_start_markers:
                if marker in stripped:
                    # Found code marker - extract from this point
                    marker_pos = stripped.find(marker)
                    if marker_pos >= 0:
                        # Extract from marker to end, or to next question marker
                        code_part = stripped[marker_pos:]
                        # Remove any trailing question text
                        # Stop at patterns like "Program 2:", "Task 2:", etc.
                        code_part = re.split(r'(?=Program\s+\d+|Task\s+\d+|Q\d+)', code_part, flags=re.IGNORECASE)[0]
                        if code_part.strip():
                            code_blocks.append(code_part.strip())
                    break
        
        if code_blocks:
            # Join all code blocks found
            extracted = "\n".join(code_blocks)
        else:
            # Fallback: line-by-line extraction
            lines = question_text.split('\n')
            code_lines = []
            in_code_block = False
            
            for line in lines:
                stripped = line.strip()
                if not stripped:
                    if in_code_block:
                        code_lines.append("")
                    continue
                
                # Check if this line starts a code block
                starts_code = any(stripped.startswith(marker) for marker in code_start_markers) or self._is_code(stripped)
                
                # Also check if line contains code markers in the middle
                if not starts_code:
                    for marker in code_start_markers:
                        if marker in stripped:
                            # Extract from marker position
                            marker_pos = stripped.find(marker)
                            if marker_pos >= 0:
                                code_part = stripped[marker_pos:]
                                code_lines.append(code_part)
                                in_code_block = True
                                break
                
                if starts_code and not in_code_block:
                    # Remove question prefix if present
                    for marker in code_start_markers:
                        if marker in stripped:
                            marker_pos = stripped.find(marker)
                            if marker_pos > 0:
                                stripped = stripped[marker_pos:]
                            break
                    in_code_block = True
                    code_lines.append(stripped)
                elif in_code_block:
                    # Continue collecting code until we hit clear non-code
                    if self._is_code(stripped) or line.startswith(("    ", "\t")) or any(ch in stripped for ch in ["{", "}", ";", "(", ")"]):
                        code_lines.append(line)
                    else:
                        # Check if it's still part of code
                        if not self._looks_like_instruction(stripped):
                            # Might be end of code block, but continue for a few more lines
                            code_lines.append(line)
            
            extracted = "\n".join(code_lines).strip()
        
        # Clean up: remove question prefixes if code starts with them
        extracted = re.sub(r'^(Program\s+\d+[:.]?\s*|Task\s+\d+[:.]?\s*|Q\d+[:.]?\s*)', '', extracted, flags=re.IGNORECASE)
        
        # Remove any remaining question text at the start
        # Look for patterns like "Function with no arguments" before code markers
        for marker in code_start_markers:
            if marker in extracted:
                marker_pos = extracted.find(marker)
                if marker_pos > 0:
                    # Check if text before marker looks like question text
                    before_marker = extracted[:marker_pos].strip()
                    if not self._is_code(before_marker) and len(before_marker) > 10:
                        # Likely question text, remove it
                        extracted = extracted[marker_pos:]
                break
        
        return extracted.strip()
    
    def _finalize_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        question = task_data["question_text"].strip()
        code = "\n".join(task_data.get("code_lines", [])).strip()
        
        # Clean up code - remove markdown code fences if present
        if code:
            code = re.sub(r'^```[a-z]*\n?', '', code, flags=re.MULTILINE)
            code = re.sub(r'\n?```$', '', code, flags=re.MULTILINE)
            code = code.strip()
        
        # If code is empty or incomplete, try to extract from question text
        if not code or self._is_incomplete_code_block(code):
            logger.info(f"Code is empty or incomplete, attempting to extract from question text")
            extracted_code = self._extract_code_from_question_text(question)
            if extracted_code and not self._is_incomplete_code_block(extracted_code):
                code = extracted_code
                logger.info(f"Successfully extracted code from question text ({len(code)} chars)")
            elif code and self._is_incomplete_code_block(code):
                logger.warning(f"Detected incomplete code block (only closing braces or fragments), will generate code instead")
                code = ""  # Clear incomplete code so we generate proper code
        
        # Detect language from extracted code first
        detected_language = self._detect_language_from_code(code) if code else None
        
        # If no code found, generate based on detected language or question context
        if not code:
            # Try to detect language from question text
            question_lower = question.lower()
            if any(indicator in question_lower for indicator in ["java", "class", "object-oriented"]):
                detected_language = "java"
            elif any(indicator in question_lower for indicator in ["c program", "#include", "printf", "scanf"]):
                detected_language = "c"
            elif any(indicator in question_lower for indicator in ["react", "jsx", "component"]):
                detected_language = "react"
            elif any(indicator in question_lower for indicator in ["html", "web page", "website"]):
                detected_language = "html"
            elif any(indicator in question_lower for indicator in ["node", "express", "server"]):
                detected_language = "node"
            
            # Generate code based on detected language
            code = self._generate_code_from_prompt(question, detected_language)
        
        ai_answer = self._generate_ai_answer(question, code)
        
        # Re-detect language from final code
        if not detected_language:
            detected_language = self._detect_language_from_code(code)
        
        return {
            "question_text": question,
            "code_snippet": code,
            "requires_screenshot": True,
            "ai_answer": ai_answer,
            "detected_language": detected_language,
        }

    def _build_aim_task(self, line: str) -> Dict[str, Any]:
        """Build aim task - will collect additional lines in _extract_tasks_from_lines"""
        question = self._clean_prompt_text(line)
        # Return a task dict that can be extended with more content
        return {
            "question_text": question,
            "code_lines": [],
            "requires_screenshot": True,
        }
    
    def _is_separate_numbered_question(self, line: str) -> bool:
        """Check if line is a clearly separate numbered question (Q1, Q2, Program 1, etc.)"""
        lower = line.lower()
        # Patterns that indicate a separate question
        separate_patterns = [
            r'^q\d+[\.:]',  # Q1., Q2:
            r'^program\s+\d+[\.:]',  # Program 1., Program 2:
            r'^question\s+\d+[\.:]',  # Question 1., Question 2:
            r'^problem\s+\d+[\.:]',  # Problem 1., Problem 2:
            r'^\d+[\.\)]\s+write\s+a\s+program',  # 1. Write a program, 2) Write a program
        ]
        return any(re.match(pattern, lower) for pattern in separate_patterns)

    def _build_prompt_task(self, line: str) -> Dict[str, Any]:
        """Build prompt task - will collect additional lines in _extract_tasks_from_lines"""
        prompt = self._clean_enumeration_prefix(line)
        question = self._ensure_program_sentence(prompt)
        # Return a task dict that can be extended with more content
        return {
            "question_text": question,
            "code_lines": [],
            "requires_screenshot": True,
        }

    def _assign_task_ids(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        for index, task in enumerate(tasks, start=1):
            task["id"] = index
        return tasks
    
    def _should_skip_line(self, lower_line: str, original_line: str) -> bool:
        if any(keyword in lower_line for keyword in self.ignore_section_keywords):
            return True
        if len(original_line.split()) <= 3 and original_line.isupper():
            return True
        if original_line.endswith(":") and len(original_line.split()) <= 6:
            return True
        return False

    def _starts_post_lab_section(self, lower_line: str) -> bool:
        return any(keyword in lower_line for keyword in self.post_lab_section_keywords)

    def _is_section_terminator(self, lower_line: str) -> bool:
        return any(keyword in lower_line for keyword in self.section_stop_keywords)

    def _looks_like_enumerated_prompt(self, line: str) -> bool:
        stripped = line.strip()
        if re.match(r"^(\d+\.|\(?[a-z]\)|\(?[ivxlcdmIVXLCDM]+\))", stripped.lower()):
            return True
        if stripped.lower().startswith("program"):
            return True
        return any(keyword in stripped.lower() for keyword in self.program_keywords)

    def _clean_enumeration_prefix(self, line: str) -> str:
        return re.sub(r"^(\(?[0-9ivxlcdmIVXLCDM]+\)?\.|\(?[a-z]\))\s*", "", line).strip()

    def _clean_prompt_text(self, line: str) -> str:
        text = self._clean_enumeration_prefix(line)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def _ensure_program_sentence(self, prompt: str) -> str:
        lower = prompt.lower()
        if any(keyword in lower for keyword in ["write", "program", "code"]):
            return prompt.strip()
        return f"Write a Python program to {prompt.strip().rstrip('.')}"

    def _is_program_prompt(self, text: str) -> bool:
        stripped = text.strip()
        if not stripped:
            return False
        lower = stripped.lower()
        if any(keyword in lower for keyword in self.program_keywords):
            return True
        if any(re.match(pattern, stripped) for pattern in self.question_patterns) and any(
            keyword in lower for keyword in ["program", "code", "python"]
        ):
            return True
        return False

    def _belongs_to_question(self, text: str) -> bool:
        lower = text.lower()
        if any(keyword in lower for keyword in self.program_keywords):
            return True
        if any(token in lower for token in ["input", "output", "example", "constraint", "hint"]):
            return True
        if text.endswith("?"):
            return True
        return False

    def _generate_ai_answer(self, question_text: str, code: str, is_aim: bool = False) -> str:
        lower = question_text.lower()
        if "fibonacci" in lower:
            return "Initialize a and b with 0 and 1, append them to the series, then iterate n times updating (a, b) to (b, a + b)."
        if "factorial" in lower:
            return "Multiply every integer from 1..n or use recursion with a base case of 1."
        if "prime" in lower:
            return "Test divisibility from 2 through sqrt(n); if no divisor is found the number is prime."
        if "pattern" in lower or "star" in lower:
            return "Use nested loops where the outer loop controls rows and the inner loop prints the required symbols."
        if "search" in lower:
            return "Iterate through the sequence comparing each value with the target until a match is found."
        if "sort" in lower:
            return "Compare adjacent elements and swap until the collection is ordered (bubble sort approach)."
        if "dictionary" in lower:
            return "Create key/value pairs, mutate entries, iterate through items, and read values safely with get()."
        if "list" in lower:
            return "Show core list APIs such as append, insert, slicing, comprehensions, and enumeration."
        if "recursion" in lower or is_aim:
            return "Break the task into smaller problems, call the same function on the reduced input, and stop at a base case."
        return "Gather inputs (if any), process them with loops or helper functions, and echo the formatted output."

    def _generate_code_from_prompt(self, prompt: str, language: Optional[str] = None) -> str:
        # Prefer AI-generated code for maximum fidelity
        if self.openai_client:
            ai_code = self._generate_code_with_openai(prompt, language)
            if ai_code:
                return ai_code

        # Generate code based on language
        if language == "java":
            return self._generate_java_code_from_prompt(prompt)
        elif language == "c":
            return self._generate_c_code_from_prompt(prompt)
        elif language == "html":
            return self._generate_html_code_from_prompt(prompt)
        elif language == "react":
            return self._generate_react_code_from_prompt(prompt)
        elif language == "node":
            return self._generate_node_code_from_prompt(prompt)
        
        # Default to Python
        lower = prompt.lower()
        templates = [
            ("fibonacci", self._template_fibonacci),
            ("factorial", self._template_factorial),
            ("prime", self._template_prime),
            ("pattern", self._template_pattern),
            ("star", self._template_pattern),
            ("table", self._template_table),
            ("list", self._template_list_ops),
            ("dictionary", self._template_dict_ops),
            ("search", self._template_linear_search),
            ("sort", self._template_bubble_sort),
            ("queue", self._template_queue),
            ("stack", self._template_stack),
            ("recursion", self._template_recursion_demo),
            ("function", self._function_suite_code),
            ("reverse", self._template_reverse_number),
            ("array", self._template_array),
        ]
        for keyword, builder in templates:
            if keyword in lower:
                return builder()
        return self._generate_default_code(prompt)
    
    def _generate_java_code_from_prompt(self, prompt: str) -> str:
        """Generate basic Java code template"""
        class_name = "Main"
        # Try to extract class name from prompt
        match = re.search(r'\b([A-Z][a-zA-Z0-9]*)\b', prompt)
        if match:
            class_name = match.group(1)
        
        return f"""public class {class_name} {{
    public static void main(String[] args) {{
        System.out.println("Hello, World!");
    }}
}}"""
    
    def _generate_c_code_from_prompt(self, prompt: str) -> str:
        """Generate basic C code template"""
        return """#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}"""
    
    def _generate_html_code_from_prompt(self, prompt: str) -> str:
        """Generate basic HTML code template"""
        return """<!DOCTYPE html>
<html>
<head>
    <title>Page Title</title>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>"""
    
    def _generate_react_code_from_prompt(self, prompt: str) -> str:
        """Generate basic React code template"""
        return """import React from 'react';

function App() {
    return (
        <div>
            <h1>Hello, World!</h1>
        </div>
    );
}

export default App;"""
    
    def _generate_node_code_from_prompt(self, prompt: str) -> str:
        """Generate basic Node.js code template"""
        return """const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});"""

    def _generate_code_for_aim(self, aim_text: str) -> str:
        lower = aim_text.lower()
        if "function" in lower:
            return self._function_suite_code()
        if "recursion" in lower:
            return self._template_recursion_demo()
        if "fibonacci" in lower:
            return self._template_fibonacci()
        if "factorial" in lower:
            return self._template_factorial()
        return self._generate_code_from_prompt(aim_text)

    def _function_suite_code(self) -> str:
        return textwrap.dedent(
            """
            def greet(name):
                print(f"Hello, {name}!")

            def add(a, b):
                return a + b

            square = lambda value: value * value

            def factorial(n):
                if n <= 1:
                    return 1
                return n * factorial(n - 1)

            def describe_student(name, *subjects, **meta):
                print(f"Student: {name}")
                print("Subjects:", ", ".join(subjects))
                for key, value in meta.items():
                    print(f"{key.title()}: {value}")

            if __name__ == "__main__":
                greet("LabMate")
                print("5 + 7 =", add(5, 7))
                print("Square of 6 =", square(6))
                print("Factorial of 5 =", factorial(5))
                describe_student("Riya", "Python", "C", batch="B1", roll="LM2025")
            """
        ).strip()

    def _template_fibonacci(self) -> str:
        return textwrap.dedent(
            """
            def fibonacci_series(count: int) -> list[int]:
                series = []
                a, b = 0, 1
                for _ in range(count):
                    series.append(a)
                    a, b = b, a + b
                return series

            if __name__ == "__main__":
                print("Fibonacci:", fibonacci_series(10))
            """
        ).strip()

    def _template_factorial(self) -> str:
        return textwrap.dedent(
            """
            def factorial(n: int) -> int:
                if n <= 1:
                    return 1
                return n * factorial(n - 1)

            if __name__ == "__main__":
                value = 6
                print(f"Factorial of {value} is {factorial(value)}")
            """
        ).strip()

    def _template_prime(self) -> str:
        return textwrap.dedent(
            """
            def is_prime(number: int) -> bool:
                if number < 2:
                    return False
                for candidate in range(2, int(number ** 0.5) + 1):
                    if number % candidate == 0:
                        return False
                return True

            if __name__ == "__main__":
                value = 29
                print(f"{value} is prime? {is_prime(value)}")
            """
        ).strip()

    def _template_pattern(self) -> str:
        return textwrap.dedent(
            """
            def print_triangle(rows: int) -> None:
                for row in range(1, rows + 1):
                    print("*" * row)

            if __name__ == "__main__":
                print_triangle(5)
            """
        ).strip()

    def _template_table(self) -> str:
        return textwrap.dedent(
            """
            def multiplication_table(number: int, upto: int = 10) -> None:
                for i in range(1, upto + 1):
                    print(f"{number} x {i} = {number * i}")

            if __name__ == "__main__":
                multiplication_table(8)
            """
        ).strip()

    def _template_list_ops(self) -> str:
        return textwrap.dedent(
            """
            def demo_list_operations():
                numbers = [3, 1, 4, 1, 5]
                numbers.append(9)
                numbers.insert(0, 2)
                squared = [n ** 2 for n in numbers]
                print("Original:", numbers)
                print("Squared:", squared)

            if __name__ == "__main__":
                demo_list_operations()
            """
        ).strip()

    def _template_dict_ops(self) -> str:
        return textwrap.dedent(
            """
            def demo_dictionary_operations():
                student = {"name": "Asha", "branch": "CSE", "year": 3}
                student["grade"] = "A"
                for key, value in student.items():
                    print(f"{key.title()}: {value}")
                print("Branch via get:", student.get("branch"))

            if __name__ == "__main__":
                demo_dictionary_operations()
            """
        ).strip()

    def _template_linear_search(self) -> str:
        return textwrap.dedent(
            """
            def linear_search(items, target):
                for index, value in enumerate(items):
                    if value == target:
                        return index
                return -1

            if __name__ == "__main__":
                data = [10, 20, 35, 50]
                look_for = 35
                position = linear_search(data, look_for)
                print(f"Found at index {position}" if position != -1 else "Not found")
            """
        ).strip()

    def _template_bubble_sort(self) -> str:
        return textwrap.dedent(
            """
            def bubble_sort(values):
                swapped = True
                while swapped:
                    swapped = False
                    for i in range(len(values) - 1):
                        if values[i] > values[i + 1]:
                            values[i], values[i + 1] = values[i + 1], values[i]
                            swapped = True
                return values

            if __name__ == "__main__":
                numbers = [5, 1, 4, 2, 8]
                print("Sorted:", bubble_sort(numbers))
            """
        ).strip()

    def _template_queue(self) -> str:
        return textwrap.dedent(
            """
            from collections import deque

            if __name__ == "__main__":
                queue = deque()
                queue.append("task1")
                queue.append("task2")
                queue.append("task3")
                while queue:
                    current = queue.popleft()
                    print("Processing", current)
            """
        ).strip()

    def _template_stack(self) -> str:
        return textwrap.dedent(
            """
            if __name__ == "__main__":
                stack = []
                stack.append("compile")
                stack.append("link")
                stack.append("run")
                while stack:
                    step = stack.pop()
                    print("Executing", step)
            """
        ).strip()

    def _template_recursion_demo(self) -> str:
        return textwrap.dedent(
            """
            def sum_of_list(values):
                if not values:
                    return 0
                return values[0] + sum_of_list(values[1:])

            if __name__ == "__main__":
                data = [1, 2, 3, 4, 5]
                print("Recursive sum:", sum_of_list(data))
            """
        ).strip()

    def _template_reverse_number(self) -> str:
        return textwrap.dedent(
            """
            def reverse_number(num: int) -> int:
                reversed_num = 0
                while num > 0:
                    reversed_num = reversed_num * 10 + num % 10
                    num //= 10
                return reversed_num

            if __name__ == "__main__":
                number = 12345
                result = reverse_number(number)
                print(f"Original: {number}")
                print(f"Reversed: {result}")
            """
        ).strip()

    def _template_array(self) -> str:
        return textwrap.dedent(
            """
            import array

            if __name__ == "__main__":
                # Integer array
                integer_array = array.array('i', [1, 2, 3, 4, 5])
                print("Integer Array:", list(integer_array))
                
                # Float array
                float_array = array.array('d', [1.0, 2.0, 3.0, 4.0])
                print("Float Array:", list(float_array))
                
                # Array operations
                print("First element:", integer_array[0])
                print("Array length:", len(integer_array))
                
                # Modify array
                integer_array.append(6)
                print("After append:", list(integer_array))
            """
        ).strip()

    def _generate_code_with_openai(self, prompt: str, language: Optional[str] = None) -> str:
        """Generate code using OpenAI API for the specified language"""
        if not self.openai_client:
            logger.warning("OpenAI not available, falling back to default template")
            return None
        
        try:
            # Determine language-specific prompt
            if language == "java":
                system_prompt = "You are an expert Java programmer. Generate COMPLETE, ERROR-FREE, executable Java code. Include proper class structure with public static void main method."
                lang_instruction = "Generate Java code with proper class and main method structure."
            elif language == "c":
                system_prompt = "You are an expert C programmer. Generate COMPLETE, ERROR-FREE, executable C code. Include #include directives and proper main function."
                lang_instruction = "Generate C code with proper #include directives and main function."
            elif language == "html":
                system_prompt = "You are an expert HTML/CSS/JavaScript developer. Generate COMPLETE, valid HTML code."
                lang_instruction = "Generate HTML code with proper structure."
            elif language == "react":
                system_prompt = "You are an expert React developer. Generate COMPLETE, valid React/JSX code."
                lang_instruction = "Generate React component code with proper JSX syntax."
            elif language == "node":
                system_prompt = "You are an expert Node.js developer. Generate COMPLETE, valid Node.js/Express code."
                lang_instruction = "Generate Node.js code with proper Express setup."
            else:
                system_prompt = LAB_CODE_GENERATION_PROMPT
                lang_instruction = "Generate Python code."

            user_prompt = f"""
Analyze the following programming requirement extracted from a lab manual. Produce COMPLETE, comprehensive {language or 'Python'} code that satisfies every instruction.

{lang_instruction}

Task:
{prompt}

CRITICAL REQUIREMENTS:
1. Generate COMPLETE, self-contained code (15-30+ lines minimum for most tasks)
2. Ensure the code runs without errors when executed directly
3. Include all necessary imports, classes, methods, and example code
4. Make the code substantial enough to demonstrate the concept fully
5. The generated code must be ready to execute without any missing components or placeholders

The generated code must be ready to execute without any missing components or placeholders.
"""
            
            response = self.openai_client.ChatCompletion.create(
                model=self.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,  # Increased to allow for more complete code
                temperature=0.1  # Lower temperature for more consistent rule-following
            )
            
            code = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if code.startswith("```python"):
                code = code[9:]
            elif code.startswith("```"):
                code = code[3:]
            if code.endswith("```"):
                code = code[:-3]
            
            code = code.strip()
            
            # Post-process: Check for inheritance and ensure base classes exist
            code = self._ensure_complete_inheritance_code(code)
            
            # Post-process: Ensure pickle code has isinstance() checks
            if 'pickle' in code:
                logger.info("[PICKLE FIX] Code contains pickle, applying type checking...")
                original_code = code
                code = self._ensure_pickle_type_checking(code)
                if code != original_code:
                    logger.info("[PICKLE FIX] isinstance() check injected successfully!")
                else:
                    logger.warning("[PICKLE FIX] No changes made - isinstance might already be present or pattern not detected")
            
            return code
            
        except Exception as e:
            logger.error(f"Failed to generate code with OpenAI: {e}")
            return None
    
    def _ensure_complete_inheritance_code(self, code: str) -> str:
        """Ensure inheritance code includes base classes and proper super() calls"""
        if not code:
            return code
        
        import re
        
        # Check if code has class inheritance
        inheritance_pattern = r'class\s+(\w+)\s*\((\w+)\)'
        matches = re.findall(inheritance_pattern, code)
        
        if not matches:
            return code
        
        # Find all base classes referenced
        base_classes = set()
        child_to_base = {}
        for child_class, base_class in matches:
            base_classes.add(base_class)
            child_to_base[child_class] = base_class
        
        # Check if base classes are defined
        defined_classes = set(re.findall(r'class\s+(\w+)', code))
        
        # Add missing base classes
        missing_bases = base_classes - defined_classes
        
        if missing_bases:
            # Generate a simple base class for each missing one
            base_class_code = []
            for base_name in missing_bases:
                # Create a basic base class with common attributes
                base_class_code.append(textwrap.dedent(f"""
                class {base_name}:
                    def __init__(self, emp_id, name, dept, salary):
                        self.emp_id = emp_id
                        self.name = name
                        self.dept = dept
                        self.salary = salary
                    
                    def __str__(self):
                        return f'name: {{self.name}}, salary: {{self.salary:.2f}}'
                    
                    def get_info(self):
                        return f"{{self.name}} works in {{self.dept}} with salary {{self.salary}}"
                """))
            
            # Insert base classes at the beginning
            code = '\n'.join(base_class_code) + '\n\n' + code
        
        # CRITICAL FIX: Ensure all child classes call super().__init__()
        lines = code.split('\n')
        fixed_lines = []
        i = 0
        
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            
            # Check if this is a class definition with inheritance (not object)
            class_match = re.match(r'class\s+(\w+)\s*\((\w+)\)', stripped)
            if class_match:
                child_class = class_match.group(1)
                base_class = class_match.group(2)
                
                fixed_lines.append(line)
                i += 1
                
                # If it's real inheritance (not object), check for __init__ and super()
                if base_class != 'object' and base_class in (defined_classes | missing_bases):
                    # Look ahead to find __init__ method
                    init_found = False
                    super_found = False
                    init_line_idx = None
                    init_indent = 0
                    
                    j = i
                    while j < len(lines) and (not lines[j].strip().startswith('class ') or j == i):
                        if 'def __init__' in lines[j]:
                            init_found = True
                            init_line_idx = j
                            init_indent = len(lines[j]) - len(lines[j].lstrip())
                            # Check if super() is called in this __init__
                            k = j + 1
                            while k < len(lines) and (not lines[k].strip() or len(lines[k]) - len(lines[k].lstrip()) > init_indent):
                                if 'super().__init__' in lines[k] or 'super(' in lines[k]:
                                    super_found = True
                                    break
                                k += 1
                            break
                        j += 1
                    
                    # If __init__ exists but super() is missing, add it
                    if init_found and not super_found and init_line_idx is not None:
                        # Find where to insert super() call (after def line, before other code)
                        insert_idx = init_line_idx + 1
                        while insert_idx < len(lines) and (not lines[insert_idx].strip() or len(lines[insert_idx]) - len(lines[insert_idx].lstrip()) > init_indent):
                            insert_idx += 1
                        
                        # Extract parameters from __init__ signature
                        init_sig = lines[init_line_idx]
                        params = []
                        if 'emp_id' in init_sig:
                            params.append('emp_id')
                        if 'name' in init_sig:
                            params.append('name')
                        if 'dept' in init_sig or 'department' in init_sig:
                            params.append('dept' if 'dept' in init_sig else 'department')
                        if 'salary' in init_sig:
                            params.append('salary')
                        
                        # Default parameters if none found
                        if not params:
                            params = ['emp_id', 'name', 'dept', 'salary']
                        
                        # Insert super() call
                        super_line = ' ' * (init_indent + 4) + f'super().__init__({", ".join(params)})'
                        lines.insert(insert_idx, super_line)
                        # Adjust indices
                        i += 1
                
                continue
            
            fixed_lines.append(line)
            i += 1
        
        return '\n'.join(lines)

    def _ensure_pickle_type_checking(self, code: str) -> str:
        """
        Ensure pickle.load() calls have isinstance() type checking.
        This prevents 'list' object has no attribute errors.
        
        Detects pattern:
            student = pickle.load(file)
            student.display()
        
        Replaces with:
            student = pickle.load(file)
            if isinstance(student, list):
                for item in student:
                    item.display()
            else:
                student.display()
        """
        if not code or 'pickle' not in code:
            return code
        
        # Use regex to find and fix the pattern
        # Pattern: variable = pickle.load(...) followed by variable.method()
        pattern = r'(\s*)(\w+)\s*=\s*pickle\.load\([^)]+\)\s*\n(\s*)(\2)\.(\w+)\('
        
        def replacer(match):
            indent1 = match.group(1)  # Indentation of pickle.load line
            var_name = match.group(2)  # Variable name (e.g., 'student')
            indent2 = match.group(3)  # Indentation of method call line
            method_name = match.group(5)  # Method name (e.g., 'display')
            
            # Build the fixed code with isinstance check
            return f'''{indent1}{var_name} = pickle.load(file)
{indent2}# Type check for pickle.load() result
{indent2}if isinstance({var_name}, list):
{indent2}    for item in {var_name}:
{indent2}        item.{method_name}(
{indent2}else:
{indent2}    {var_name}.{method_name}('''
        
        # Apply the fix
        fixed_code = re.sub(pattern, replacer, code)
        
        # If no changes were made, try a simpler pattern (just method call on same line)
        if fixed_code == code:
            # Try to find: student.display() where student came from pickle.load
            # This is trickier, so let's use a line-by-line approach
            lines = code.split('\n')
            fixed_lines = []
            pickle_vars = set()
            
            for i, line in enumerate(lines):
                stripped = line.strip()
                
                # Track variables assigned from pickle.load
                if 'pickle.load' in stripped and '=' in stripped:
                    match = re.match(r'(\w+)\s*=\s*pickle\.load', stripped)
                    if match:
                        pickle_vars.add(match.group(1))
                
                # Check if this line calls a method on a pickle variable
                needs_fix = False
                for var in pickle_vars:
                    if f'{var}.' in stripped and '(' in stripped:
                        # Check if isinstance is already present in surrounding lines
                        has_isinstance = False
                        for j in range(max(0, i-3), min(len(lines), i+1)):
                            if f'isinstance({var}' in lines[j]:
                                has_isinstance = True
                                break
                        
                        if not has_isinstance:
                            needs_fix = True
                            indent = len(line) - len(line.lstrip())
                            indent_str = ' ' * indent
                            
                            # Insert isinstance check before this line
                            fixed_lines.append(f'{indent_str}# Type check for pickle.load() result')
                            fixed_lines.append(f'{indent_str}if isinstance({var}, list):')
                            fixed_lines.append(f'{indent_str}    for item in {var}:')
                            # Replace var with 'item' in the method call
                            fixed_call = line.replace(f'{var}.', 'item.', 1)
                            fixed_lines.append(f'{indent_str}    {fixed_call.strip()}')
                            fixed_lines.append(f'{indent_str}else:')
                            fixed_lines.append(line)
                            continue
                
                if not needs_fix:
                    fixed_lines.append(line)
            
            fixed_code = '\n'.join(fixed_lines)
        
        return fixed_code

    def _generate_default_code(self, prompt: str) -> str:
        return textwrap.dedent(
            f"""
            # Auto-generated placeholder for: {prompt}
            def main():
                raise NotImplementedError("Precise instructions required to implement this task.")

            if __name__ == "__main__":
                main()
            """
        ).strip()

    def sanitize_code_snippet(self, code: str, question_text: Optional[str] = None) -> str:
        if not code:
            return code

        # If code looks incomplete (starts with closing braces), try to extract from question_text
        if self._is_incomplete_code_block(code) and question_text:
            logger.info("Code snippet is incomplete, attempting to extract from question text")
            extracted = self._extract_code_from_question_text(question_text)
            if extracted and not self._is_incomplete_code_block(extracted):
                logger.info(f"Successfully extracted complete code from question text")
                return extracted

        sanitized_lines: List[str] = []
        question_lookup = set()
        if question_text:
            # Only add question parts that are clearly NOT code
            question_parts = re.split(r"[\n•\-–]", question_text)
            for part in question_parts:
                candidate = part.strip()
                # Don't add code-like content to question_lookup
                if len(candidate) > 8 and not self._is_code(candidate):
                    # Only add if it doesn't look like code
                    if not any(marker in candidate.lower() for marker in ["#include", "int main", "void main", "public class", "def ", "import ", "function "]):
                        question_lookup.add(candidate.lower())

        for line in code.splitlines():
            stripped = line.strip()
            if not stripped:
                sanitized_lines.append("")  # Preserve empty lines in code
                continue

            lowered = stripped.lower()
            # Only remove if it's clearly question text, not code
            if question_lookup and lowered in question_lookup:
                # Double check - don't remove if it looks like code
                if not self._is_code(stripped):
                    continue

            if self._looks_like_instruction(stripped):
                continue

            sanitized_lines.append(line)

        result = "\n".join(sanitized_lines).strip()
        
        # Final check - if result is still incomplete, try extracting from question_text again
        if self._is_incomplete_code_block(result) and question_text:
            extracted = self._extract_code_from_question_text(question_text)
            if extracted and not self._is_incomplete_code_block(extracted):
                return extracted
        
        return result

    def _looks_like_instruction(self, text: str) -> bool:
        if not text:
            return True

        lowered = text.lower()
        
        # Filter out common instruction patterns
        instruction_patterns = [
            "aim:",
            "aim",
            "objective:",
            "objective",
            "write a program",
            "create a",
            "demonstrate",
            "implement",
            "print '",
            "print \"",
            "print %",
            "when an object is printed",
            "create two derived classes",
            "create a class",
            "create a function",
        ]
        
        if any(pattern in lowered for pattern in instruction_patterns):
            return True
        
        code_markers = [
            "#include",
            "import ",
            "from ",
            "printf",
            "scanf",
            "cin >>",
            "cout <<",
            "system.out",
            "public static",
            "class ",
            "def ",
            "return ",
            "lambda ",
            "function ",
            "let ",
            "var ",
            "const ",
            "console.",
            "document.",
            "=>",
            "int ",
            "float ",
            "double ",
            "bool ",
            "switch",
            "case ",
            "break",
            "continue",
        ]
        if any(marker in lowered for marker in code_markers):
            return False

        if any(ch in text for ch in '=;{}[]<>#/*\\:"\'0123456789'):
            return False

        if text.rstrip().endswith(":"):
            return False

        words = text.split()
        if len(words) < 4:
            return False

        call_match = re.search(r"([A-Za-z_][A-Za-z0-9_]*)\s*\((.*?)\)", text)
        if call_match:
            func_name = call_match.group(1).lower()
            inner = call_match.group(2)
            if func_name in {"print", "scanf", "printf", "cin", "cout"}:
                return False
            if any(ch in inner for ch in '=;{}[]<>#/*\\:"\'0123456789'):
                return False

        return True
    
    def _is_code(self, text: str) -> bool:
        if not text:
            return False

        stripped = text.strip()
        if not stripped:
            return False

        if self._looks_like_instruction(stripped):
            return False

        if stripped.startswith(("    ", "\t")):
            return True

        if stripped.startswith(("#", "//", "/*")):
            return True

        if any(ch in stripped for ch in ["{", "}", ";"]):
            return True

        if re.search(r"\b\d+\b", stripped) and any(op in stripped for op in ["=", "+", "-", "*", "/", "%"]):
            return True

        structural_patterns = [
            r"^\s*def\s+[A-Za-z_]\w*\s*\(",
            r"^\s*class\s+[A-Za-z_]\w*",
            r"^\s*import\s+\w",
            r"^\s*from\s+\w",
            r"^\s*#include\s+",
            r"^\s*using\s+namespace",
            r"^\s*public\s+static\s+void\s+main",
            r"^\s*(if|elif|else|for|while|try|except|with)\b.*(:|\))",
            r"^\s*System\.out\.println",
            r"^\s*console\.log",
            r"^\s*document\.get",
            r"^\s*print\s*\(",
            r"^\s*return\b",
        ]
        if any(re.search(pattern, stripped) for pattern in structural_patterns):
            return True

        if re.search(r"[A-Za-z_][A-Za-z0-9_]*\s*=>", stripped):
            return True

        if re.search(r"[A-Za-z_][A-Za-z0-9_]*\(", stripped):
            return True

        if re.search(r"[A-Za-z_][A-Za-z0-9_]*\s*[\+\-\*/]?=", stripped):
            return True
        
        if any(indicator in stripped for indicator in self.code_indicators):
            return True
        
        comment_patterns = [r"^\s*#.*$", r"^\s*//.*$", r"^\s*/\*.*\*/"]
        if any(re.match(pattern, stripped) for pattern in comment_patterns):
            return True

        return False


parser_service = ParserService()
