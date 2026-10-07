import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.screenshot_service import ScreenshotService
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

async def generate_and_embed_all():
    print("=" * 60)
    print("STARTING MULTI-LANGUAGE SCREENSHOT & EMBEDDING SUITE")
    print("=" * 60)

    service = ScreenshotService()
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "test_screenshots")
    os.makedirs(output_dir, exist_ok=True)

    test_cases = [
        {
            "language": "python",
            "subject": "Python",
            "theme": "idle",
            "filename": "factorial.py",
            "manual": "sample_lab_manuals/python_lab_manual.docx",
            "output_doc": "test_screenshots/python_lab_manual_with_screenshots.docx",
            "code": """def factorial(n):
    if n < 0:
        raise ValueError("Factorial is not defined for negative numbers")
    if n in (0, 1):
        return 1
    return n * factorial(n - 1)

if __name__ == "__main__":
    test_val = 5
    print(f"Calculating factorial for {test_val}...")
    result = factorial(test_val)
    print(f"Result: {test_val}! = {result}")""",
            "output": """Calculating factorial for 5...
Result: 5! = 120

================== RESTART: C:/Users/Student/factorial.py ==================
>>> """
        },
        {
            "language": "java",
            "subject": "Java",
            "theme": "notepad",
            "filename": "StudentGrade.java",
            "manual": "sample_lab_manuals/java_lab_manual.docx",
            "output_doc": "test_screenshots/java_lab_manual_with_screenshots.docx",
            "code": """import java.util.Scanner;

public class StudentGrade {
    public static void main(String[] args) {
        Scanner scanner = new Scanner("Alice\\n85\\n92\\n78\\n");
        System.out.print("Enter Student Name: ");
        String name = scanner.nextLine();
        System.out.println(name);
        
        System.out.print("Enter Mark 1: ");
        int m1 = scanner.nextInt();
        System.out.println(m1);
        
        System.out.print("Enter Mark 2: ");
        int m2 = scanner.nextInt();
        System.out.println(m2);
        
        System.out.print("Enter Mark 3: ");
        int m3 = scanner.nextInt();
        System.out.println(m3);
        
        int total = m1 + m2 + m3;
        double pct = total / 3.0;
        char grade = (pct >= 85) ? 'A' : 'B';
        
        System.out.println("\\n--- Result Sheet ---");
        System.out.printf("Student: %s | Total: %d | Percentage: %.2f%% | Grade: %c\\n", name, total, pct, grade);
    }
}""",
            "output": """C:\\Users\\Student\\workspace>javac StudentGrade.java
C:\\Users\\Student\\workspace>java StudentGrade
Enter Student Name: Alice
Enter Mark 1: 85
Enter Mark 2: 92
Enter Mark 3: 78

--- Result Sheet ---
Student: Alice | Total: 255 | Percentage: 85.00% | Grade: A"""
        },
        {
            "language": "c",
            "subject": "C",
            "theme": "codeblocks",
            "filename": "bubble_sort.c",
            "manual": "sample_lab_manuals/c_lab_manual.docx",
            "output_doc": "test_screenshots/c_lab_manual_with_screenshots.docx",
            "code": """#include <stdio.h>

void bubbleSort(int arr[], int n) {
    int i, j, temp;
    for (i = 0; i < n - 1; i++) {
        for (j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    int data[] = {64, 34, 25, 12, 22, 11, 90};
    int n = sizeof(data) / sizeof(data[0]);
    
    printf("Original array: ");
    for (int i = 0; i < n; i++) printf("%d ", data[i]);
    printf("\\n");
    
    bubbleSort(data, n);
    
    printf("Sorted array:   ");
    for (int i = 0; i < n; i++) printf("%d ", data[i]);
    printf("\\n");
    return 0;
}""",
            "output": """Original array: 64 34 25 12 22 11 90 
Sorted array:   11 12 22 25 34 64 90 

Process returned 0 (0x0)   execution time : 0.015 s
Press any key to continue."""
        },
        {
            "language": "cpp",
            "subject": "C++",
            "theme": "codeblocks",
            "filename": "matrix_addition.cpp",
            "manual": "sample_lab_manuals/cpp_lab_manual.docx",
            "output_doc": "test_screenshots/cpp_lab_manual_with_screenshots.docx",
            "code": """#include <iostream>
using namespace std;

class Matrix {
private:
    int mat[2][2];
public:
    Matrix() {
        for (int i = 0; i < 2; i++)
            for (int j = 0; j < 2; j++) mat[i][j] = 0;
    }
    void set(int a, int b, int c, int d) {
        mat[0][0] = a; mat[0][1] = b;
        mat[1][0] = c; mat[1][1] = d;
    }
    Matrix operator+(const Matrix& other) {
        Matrix res;
        for (int i = 0; i < 2; i++)
            for (int j = 0; j < 2; j++)
                res.mat[i][j] = this->mat[i][j] + other.mat[i][j];
        return res;
    }
    void display() const {
        for (int i = 0; i < 2; i++) {
            cout << "[ " << mat[i][0] << " " << mat[i][1] << " ]" << endl;
        }
    }
};

int main() {
    Matrix m1, m2;
    m1.set(1, 2, 3, 4);
    m2.set(5, 6, 7, 8);
    cout << "Matrix A:" << endl; m1.display();
    cout << "Matrix B:" << endl; m2.display();
    Matrix sum = m1 + m2;
    cout << "Sum Matrix (A + B):" << endl; sum.display();
    return 0;
}""",
            "output": """Matrix A:
[ 1 2 ]
[ 3 4 ]
Matrix B:
[ 5 6 ]
[ 7 8 ]
Sum Matrix (A + B):
[ 6 8 ]
[ 10 12 ]

Process returned 0 (0x0)   execution time : 0.021 s
Press any key to continue."""
        },
        {
            "language": "html",
            "subject": "Web Development",
            "theme": "html",
            "filename": "counter.html",
            "manual": "sample_lab_manuals/webdev_lab_manual.docx",
            "output_doc": "test_screenshots/webdev_lab_manual_with_screenshots.docx",
            "code": """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Interactive Counter Widget</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f4f8; margin: 0; }
    .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; width: 320px; }
    .count { font-size: 3.5rem; font-weight: bold; color: #2563eb; margin: 1rem 0; }
    .btn-group { display: flex; gap: 0.5rem; justify-content: center; }
    button { padding: 0.6rem 1.2rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; }
    .btn-inc { background: #2563eb; color: white; }
    .btn-dec { background: #ef4444; color: white; }
    .btn-reset { background: #e2e8f0; color: #334155; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Interactive Counter</h2>
    <div class="count" id="display">7</div>
    <div class="btn-group">
      <button class="btn-dec" id="dec">-</button>
      <button class="btn-reset" id="reset">Reset</button>
      <button class="btn-inc" id="inc">+</button>
    </div>
  </div>
</body>
</html>""",
            "output": """HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Server: Node/18.x Vite/4.5
Port: 3000

Loaded DOM tree in 18ms.
Interactive Counter component initialized successfully. Current state: count=7."""
        }
    ]

    results = []

    for test in test_cases:
        lang = test["language"]
        subj = test["subject"]
        theme = test["theme"]
        print(f"\n[TESTING] Language: {subj} ({lang}) | Theme: {theme}...")

        # 1. Generate realistic screenshot
        success, img_path, w, h = await service.generate_screenshot(
            code=test["code"],
            output=test["output"],
            theme=theme,
            job_id=999,
            username="Student",
            filename=test["filename"]
        )

        if not success or not os.path.exists(img_path):
            print(f"  [FAIL] FAILED to generate screenshot for {subj}!")
            results.append({"subject": subj, "status": "FAIL", "error": "Screenshot generation failed"})
            continue

        file_size = os.path.getsize(img_path)
        print(f"  [PASS] Screenshot SUCCESS: {img_path} ({w}x{h}, {file_size} bytes)")

        # 2. Embed screenshot into existing Word document
        manual_path = os.path.join(os.path.dirname(__file__), "..", "..", test["manual"])
        out_doc_path = os.path.join(os.path.dirname(__file__), "..", "..", test["output_doc"])

        if os.path.exists(manual_path):
            doc = Document(manual_path)
            
            # Add separation header
            doc.add_page_break()
            p_hdr = doc.add_paragraph()
            r_hdr = p_hdr.add_run("PROGRAM EXECUTION OUTPUT & IDE SCREENSHOTS")
            r_hdr.font.name = 'Times New Roman'
            r_hdr.font.size = Pt(14)
            r_hdr.font.bold = True

            # Add question description
            p_desc = doc.add_paragraph()
            r_desc = p_desc.add_run(f"Exercise 1 Output - {test['filename']}:")
            r_desc.font.name = 'Times New Roman'
            r_desc.font.size = Pt(12)
            r_desc.font.bold = True

            # Add screenshot image
            p_img = doc.add_paragraph()
            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run_img = p_img.add_run()
            run_img.add_picture(img_path, width=Inches(6.2))

            # Add caption
            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r_cap = p_cap.add_run(f"Figure: Realistic {theme.upper()} IDE screenshot and terminal execution output for {test['filename']}")
            r_cap.font.name = 'Times New Roman'
            r_cap.font.size = Pt(10)
            r_cap.font.italic = True

            doc.save(out_doc_path)
            print(f"  [PASS] Composed Word document saved: {out_doc_path} ({os.path.getsize(out_doc_path)} bytes)")
            results.append({
                "subject": subj,
                "status": "PASS",
                "screenshot": img_path,
                "dimensions": f"{w}x{h}",
                "size_bytes": file_size,
                "word_doc": out_doc_path
            })
        else:
            print(f"  [FAIL] Manual not found: {manual_path}")
            results.append({"subject": subj, "status": "FAIL", "error": "Manual not found"})

    print("\n" + "=" * 60)
    print("ALL SCREENSHOT & DOCUMENT EMBEDDING TESTS COMPLETED")
    print("=" * 60)
    for r in results:
        status_icon = "[PASS]" if r["status"] == "PASS" else "[FAIL]"
        print(f"{status_icon} {r['subject']}: {r['status']} | Word doc: {r.get('word_doc', 'N/A')}")

    return results

if __name__ == "__main__":
    asyncio.run(generate_and_embed_all())
