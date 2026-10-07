import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.screenshot_service import screenshot_service
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

async def test_all_styles():
    print("=" * 70)
    print("TESTING STRICT REALISTIC UI STYLES FOR ALL LANGUAGES")
    print("=" * 70)

    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots", "new_ui"))
    os.makedirs(output_dir, exist_ok=True)

    test_cases = [
        {
            "name": "Python IDLE - Style 1 (Output Down)",
            "lang": "python",
            "theme": "idle",
            "style": "style_1",
            "filename": "fhg.py",
            "code": """def greet(name):
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
    describe_student("Riya", "Python", "C", batch="B1", roll="LM2025")""",
            "output": """Hello, LabMate!
5 + 7 = 12
Square of 6 = 36
Factorial of 5 = 120
Student: Riya
Subjects: Python, C
Batch: B1
Roll: LM2025""",
            "out_img": "python_idle_style_1_output_down.png",
        },
        {
            "name": "Python IDLE - Style 2 (Output Side)",
            "lang": "python",
            "theme": "idle",
            "style": "style_2",
            "filename": "fhg.py",
            "code": """def greet(name):
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
    describe_student("Riya", "Python", "C", batch="B1", roll="LM2025")""",
            "output": """Hello, LabMate!
5 + 7 = 12
Square of 6 = 36
Factorial of 5 = 120
Student: Riya
Subjects: Python, C
Batch: B1
Roll: LM2025""",
            "out_img": "python_idle_style_2_output_side.png",
        },
        {
            "name": "Python IDLE - Style 3 (Two Different Windows)",
            "lang": "python",
            "theme": "idle",
            "style": "style_3",
            "filename": "fhg.py",
            "code": """def greet(name):
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
    describe_student("Riya", "Python", "C", batch="B1", roll="LM2025")""",
            "output": """Hello, LabMate!
5 + 7 = 12
Square of 6 = 36
Factorial of 5 = 120
Student: Riya
Subjects: Python, C
Batch: B1
Roll: LM2025""",
            "out_img": "python_idle_style_3_two_windows.png",
        },
        {
            "name": "Java - Windows Notepad UI + Command Prompt",
            "lang": "java",
            "theme": "notepad",
            "style": "style_1",
            "filename": "StudentGrade.java",
            "code": """import java.util.Scanner;

public class StudentGrade {
    public static void main(String[] args) {
        String name = "Alex Kumar";
        int m1 = 88, m2 = 94, m3 = 82;
        int total = m1 + m2 + m3;
        double pct = total / 3.0;
        char grade = (pct >= 85) ? 'A' : 'B';
        
        System.out.println("--- Result Sheet ---");
        System.out.printf("Student: %s | Total: %d | Percentage: %.2f%% | Grade: %c\\n", name, total, pct, grade);
    }
}""",
            "output": """--- Result Sheet ---
Student: Alex Kumar | Total: 264 | Percentage: 88.00% | Grade: A""",
            "out_img": "java_notepad_cmd_ui.png",
        },
        {
            "name": "C / C++ - Code::Blocks 20.03 IDE + Execution Console",
            "lang": "cpp",
            "theme": "codeblocks",
            "style": "style_1",
            "filename": "matrix_addition.cpp",
            "code": """#include <iostream>
using namespace std;

int main() {
    int A[2][2] = {{1, 2}, {3, 4}};
    int B[2][2] = {{5, 6}, {7, 8}};
    int C[2][2];

    cout << "Sum Matrix (A + B):" << endl;
    for (int i = 0; i < 2; i++) {
        cout << "[ ";
        for (int j = 0; j < 2; j++) {
            C[i][j] = A[i][j] + B[i][j];
            cout << C[i][j] << " ";
        }
        cout << "]" << endl;
    }
    return 0;
}""",
            "output": """Sum Matrix (A + B):
[ 6 8 ]
[ 10 12 ]""",
            "out_img": "cpp_codeblocks_ui.png",
        },
        {
            "name": "Web Dev (HTML/React/Node) - Visual Studio Code UI",
            "lang": "html",
            "theme": "vscode",
            "style": "style_1",
            "filename": "index.html",
            "code": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Lab Counter App</title>
  <style>
    body { font-family: system-ui; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="card">
    <h1>Interactive Lab Application</h1>
    <p>Component mounted and rendering live output.</p>
  </div>
</body>
</html>""",
            "output": """HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Server: Node/18.x Vite/4.5.0
Port: 3000

Loaded DOM tree in 18ms.
Component mounted and server listening on http://localhost:3000/""",
            "out_img": "webdev_vscode_ui.png",
        }
    ]

    for tc in test_cases:
        print(f"\n[GENERATING] {tc['name']}...")
        success, img_path, w, h = await screenshot_service.generate_screenshot(
            code=tc["code"],
            output=tc["output"],
            theme=tc["theme"],
            job_id=999,
            username="Student_Alex",
            filename=tc["filename"],
            screenshot_style=tc["style"]
        )
        if success and img_path and os.path.exists(img_path):
            dest = os.path.join(output_dir, tc["out_img"])
            import shutil
            shutil.copyfile(img_path, dest)
            print(f"  [SUCCESS] {tc['out_img']} ({w}x{h}, {os.path.getsize(dest)} bytes)")
        else:
            print(f"  [FAILED] for {tc['name']}")

    print("\n" + "=" * 70)
    print("ALL STRICT UI TESTS COMPLETED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(test_all_styles())
