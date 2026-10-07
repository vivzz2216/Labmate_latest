"""Re-run the eight reviewed lab reports from their saved workflow records.

This first stage writes a manifest and verified screenshots only. It does not
overwrite uploads, reports, or database rows. Run the document composer after
all executions succeed and the evidence has been inspected.
"""

import argparse
import asyncio
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.security.generated_code import validate_generated_code
from app.services.runtime_engine import runtime_engine
from app.services.screenshot_service import screenshot_service


STUDENT = "Vivek Pillai"
USN = "USN-2024-001"

FIXED_CODE = {
    (4, 1): '''class Employee:
    total = 0

    def __init__(self, emp_id, name, dept, salary):
        self.emp_id, self.name, self.dept = emp_id, name, dept
        self.salary = salary
        Employee.total += 1

    def __str__(self):
        return f"name: {self.name}\\nsalary: {self.salary:10.2f}"

    def update_salary(self, amount):
        self.salary = amount

class Manager(Employee):
    pass

class Staff(Employee):
    pass

employees = {
    "USN-2024-001": Manager("USN-2024-001", "Vivek Pillai", "Information Technology", 70000),
    "STF-001": Staff("STF-001", "Vivek Pillai", "Information Technology", 50000),
}
while True:
    print("\\nEmployee Management Menu\\n1. Update Salary\\n2. Display All Employees")
    print("3. Show Total Employees\\n4. Exit")
    choice = input("Enter choice: ").strip()
    if choice == "1":
        emp_id = input("Enter Employee ID to update: ").strip()
        employee = employees.get(emp_id)
        if employee is None:
            print("Employee not found.")
        else:
            try:
                employee.update_salary(float(input("Enter new salary: ")))
                print("Salary updated.")
            except ValueError:
                print("Invalid salary amount.")
    elif choice == "2":
        for employee in employees.values():
            print(f"ID: {employee.emp_id}\\n{employee}\\nDept: {employee.dept}\\n---")
    elif choice == "3":
        print("Total employees:", Employee.total)
    elif choice == "4":
        print("Exiting program.")
        break
    else:
        print("Invalid choice.")
''',
    (4, 2): '''class College:
    def __init__(self, name, department, institution):
        self.name = name
        self.department = department
        self.institution = institution

    def display(self):
        print(f"Name: {self.name}")
        print(f"Department: {self.department}")
        print(f"Institution: {self.institution}")

class Student(College):
    def __init__(self, name, usn, department, institution):
        super().__init__(name, department, institution)
        self.usn = usn

    def display(self):
        print("Student details")
        super().display()
        print(f"USN: {self.usn}")

class Faculty(College):
    def __init__(self, name, department, institution, designation):
        super().__init__(name, department, institution)
        self.designation = designation

    def display(self):
        print("Faculty details")
        super().display()
        print(f"Designation: {self.designation}")

institution = "St Francis Institute of Technology"
department = "Information Technology"
student = Student("Vivek Pillai", "USN-2024-001", department, institution)
faculty = Faculty("Dr A Sharma", department, institution, "Professor")
student.display()
print()
faculty.display()
''',
    (5, 3): '''from array import array

numbers = array("i", [10, 20, 30, 40, 50])
print("Original array:", numbers.tolist())
print("Index [0]:", numbers[0])
print("Index [-1]:", numbers[-1])
print("Slice [1:4]:", numbers[1:4].tolist())
print("Slice [::2]:", numbers[::2].tolist())
print("Reversed slice [::-1]:", numbers[::-1].tolist())
''',
    (6, 4): '''from functools import reduce

numbers = [12, 7, 19, 24, 30]
print("Original numbers:", numbers)
print("lambda with map (double):", list(map(lambda n: n * 2, numbers)))
print("lambda with filter (even):", list(filter(lambda n: n % 2 == 0, numbers)))
print("lambda with reduce (sum):", reduce(lambda total, n: total + n, numbers))
''',
    (8, 1): '''student_name = "Vivek Pillai"
usn = "USN-2024-001"
print(f"Student: {student_name}, USN: {usn}")

integer_value = 42
float_value = 3.14159
complex_value = 2 + 3j
print("Integer:", integer_value, type(integer_value))
print("Float:", float_value, type(float_value))
print("Complex:", complex_value, type(complex_value))

mixed_sum = integer_value + float_value
print(f"{integer_value} + {float_value} = {mixed_sum} (type {type(mixed_sum)})")
converted_sum = integer_value + int(float_value)
print(f"{integer_value} + int({float_value}) = {converted_sum} (type {type(converted_sum)})")
print(f"{integer_value} * {complex_value} = {integer_value * complex_value}")
''',
    (8, 3): '''student_name = "Vivek Pillai"
values = (1, 2, 3, 2, 5, 2, 8)
print("Student:", student_name)
print("Tuple:", values)
print("Python tuples have exactly TWO methods: count() and index().")
print("Method 1 - count(2):", values.count(2))
print("Method 2 - index(5):", values.index(5))
print("The following EIGHT examples are operations/functions, NOT tuple methods:")
print("1 len:", len(values))
print("2 max:", max(values))
print("3 min:", min(values))
print("4 sum:", sum(values))
print("5 slice [2:5]:", values[2:5])
print("6 concatenation:", values + (10, 20))
print("7 repetition:", (10, 20) * 2)
print("8 conversion to list:", list(values))
''',
    (10, 3): '''def calculate_bill(units):
    if not 0 <= units <= 310:
        raise ValueError("The stated tariff covers only 0 to 310 units.")
    free = min(units, 10)
    first_slab = min(max(units - free, 0), 100)
    second_slab = min(max(units - free - first_slab, 0), 200)
    return first_slab * 5 + second_slab * 10

try:
    units = int(input("Enter electricity units (0-310): "))
    print(f"Electricity bill for {units} units: Rs {calculate_bill(units)}")
except ValueError as error:
    print("Invalid input:", error)
''',
    (11, 1): '''print("Natural numbers from 1 to 100:")
for number in range(1, 101):
    print(number, end=" " if number < 100 else "\\n")
''',
    (11, 2): '''n = int(input("Enter a positive integer n: "))
if n < 1:
    print("Please enter a positive integer.")
else:
    total = 0
    for number in range(1, n + 1):
        total += number
    print(f"Sum of natural numbers from 1 to {n}: {total}")
''',
    (11, 3): '''def read_marks(student_number):
    while True:
        text = input(f"Student {student_number} - enter three marks (space-separated): ")
        try:
            marks = [int(value) for value in text.split()]
        except ValueError:
            marks = []
        if len(marks) == 3 and all(0 <= mark <= 100 for mark in marks):
            return marks
        print("Enter exactly three whole-number marks from 0 to 100.")

for student_number in range(1, 11):
    marks = read_marks(student_number)
    total = sum(marks)
    average = total / 3
    status = "Pass" if average > 50 else "Fail"
    print(f"Student {student_number}: marks={marks}, total={total}, average={average:.2f}, {status}")
''',
    (11, 4): '''print("Star pattern with five rows:")
for row in range(1, 6):
    print("*" * row)
''',
}

CODE_REPLACEMENTS = {
    (10, 2): [("int(input().strip())", "int(input('Enter year: ').strip())")],
    (10, 4): [("a = int(input())", "a = int(input('First number: '))"),
              ("b = int(input())", "b = int(input('Second number: '))"),
              ("c = int(input())", "c = int(input('Third number: '))")],
    (11, 5): [("input().strip()", "input('Enter the multiplication table number: ').strip()")],
    (11, 7): [("input().strip()", "input('Enter a non-negative integer: ').strip()")],
    (11, 8): [("input().strip()", "input('Enter an integer to reverse: ').strip()")],
}

STDIN = {
    (4, 1): "1\nUSN-2024-001\n75000\n2\n3\n4\n",
    (10, 1): "80\n75\n70\n",
    (10, 2): "2020\n",
    (10, 3): "250\n",
    (10, 4): "7\n3\n9\n",
    (11, 2): "10\n",
    (11, 3): "78 85 92\n55 48 62\n30 40 35\n90 88 94\n70 65 72\n45 55 50\n60 62 58\n82 79 85\n49 51 47\n100 98 95\n",
    (11, 5): "5\n",
    (11, 7): "5\n",
    (11, 8): "12345\n",
}

REPORT_NAMES = {
    4: "EXP_8_inheritance_completed.docx",
    5: "Exp5_Data_Structure_Arrays_completed.docx",
    6: "ExP6_Functions_and_Exception_Handling_1__completed.docx",
    7: "EXP7_classes_and_constructors_completed.docx",
    8: "EXP_1_Data_types_docx_completed.docx",
    9: "EXP_2_Math_and_string_methods_completed.docx",
    10: "EXP_3_Conditional_statement_completed.docx",
    11: "EXP_4_Lab_writeup_Loop_statements_completed.docx",
}


def corrected_code(workflow_id, result):
    key = workflow_id, result["id"]
    code = FIXED_CODE.get(key, result["code"])
    for original, replacement in CODE_REPLACEMENTS.get(key, []):
        if original not in code:
            if replacement in code:
                continue  # The recovered local DB already contains this repair.
            raise ValueError(f"Expected source fragment is missing for {key}: {original}")
        code = code.replace(original, replacement, 1)
    return code


async def main(destination):
    destination.mkdir(parents=True, exist_ok=True)
    settings.SCREENSHOT_DIR = str(destination / "evidence")
    database = sqlite3.connect("labmate.db")
    manifest = {"reports": [], "repaired": []}
    for workflow_id, report_name in REPORT_NAMES.items():
        row = database.execute("SELECT w.results, u.file_path FROM assignment_workflows w JOIN uploads u ON u.id=w.upload_id WHERE w.id=?", (workflow_id,)).fetchone()
        if not row:
            raise ValueError(f"Workflow {workflow_id} is absent.")
        results = json.loads(row[0])
        original_upload = str(Path(row[1]).resolve()) if row[1] and Path(row[1]).is_file() else (row[1] or "")
        report = {"workflow_id": workflow_id, "name": report_name, "original_upload": original_upload, "results": []}
        for result in results:
            key = workflow_id, result["id"]
            code = corrected_code(workflow_id, result)
            validate_generated_code(code, "python")
            stdin = STDIN.get(key)
            if "input(" in code and not stdin:
                raise ValueError(f"No explicit input was specified for {key}.")
            execution = await runtime_engine.execute(code, "python", filename=f"q{result['id']}.py", stdin=stdin)
            if not execution.success:
                raise RuntimeError(f"{key} failed: {execution.error}")
            if stdin and any(value not in execution.output for value in stdin.splitlines()):
                raise RuntimeError(f"{key} did not visibly echo every input.")
            capture_paths = []
            for view in ("editor", "shell"):
                okay, image_path, _, _ = await screenshot_service.generate_screenshot(
                    code, execution.output, "idle", f"verified_{workflow_id}_{result['id']}",
                    STUDENT.split()[0], f"q{result['id']}.py",
                    screenshot_style="style_1", stdin_data=stdin, input_echoed=True,
                    view_mode=view,
                )
                if not okay:
                    raise RuntimeError(f"Screenshot capture failed for {key}, view={view}: {image_path}")
                capture_paths.append(str(Path(image_path).resolve()))
            result.update(code=code, output=execution.output, error="", status="completed", screenshot_paths=capture_paths)
            manifest["repaired"].append({"workflow_id": workflow_id, "question_id": result["id"], "input": stdin or "", "output": execution.output})
            print(f"Verified workflow {workflow_id}, question {result['id']}: {len(execution.output)} output chars", flush=True)
            report["results"].append(result)
        manifest["reports"].append(report)
    (destination / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifest: {destination / 'manifest.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    arguments = parser.parse_args()
    asyncio.run(main(arguments.output_dir.resolve()))
