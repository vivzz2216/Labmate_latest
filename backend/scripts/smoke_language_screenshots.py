"""Run trusted sample programs and capture their report-style screenshots for QA."""

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.services.runtime_engine import RuntimeEngine
from app.services.screenshot_service import ScreenshotService


SAMPLES = {
    "python": {
        "filename": "sum_two_numbers.py",
        "stdin": "25\n17\n",
        "code": 'a = int(input("Enter first number: "))\nb = int(input("Enter second number: "))\nprint("Sum:", a + b)\n',
        "views": ("editor", "shell"),
    },
    "c": {
        "filename": "sum_two_numbers.c",
        "stdin": "25\n17\n",
        "code": '#include <stdio.h>\nint main(void) {\n    int a, b;\n    printf("Enter first number: ");\n    scanf("%d", &a);\n    printf("Enter second number: ");\n    scanf("%d", &b);\n    printf("Sum: %d\\n", a + b);\n    return 0;\n}\n',
        "views": ("split", "output"),
    },
    "cpp": {
        "filename": "sum_two_numbers.cpp",
        "stdin": "25\n17\n",
        "code": '#include <iostream>\nint main() {\n    int a, b;\n    std::cout << "Enter first number: ";\n    std::cin >> a;\n    std::cout << "Enter second number: ";\n    std::cin >> b;\n    std::cout << "Sum: " << a + b << "\\n";\n}\n',
        "views": ("split", "output"),
    },
    "java": {
        "filename": "SumTwoNumbers.java",
        "stdin": "25\n17\n",
        "code": 'import java.util.Scanner;\npublic class SumTwoNumbers {\n    public static void main(String[] args) {\n        Scanner scanner = new Scanner(System.in);\n        System.out.print("Enter first number: ");\n        int a = scanner.nextInt();\n        System.out.print("Enter second number: ");\n        int b = scanner.nextInt();\n        System.out.println("Sum: " + (a + b));\n    }\n}\n',
        "views": ("split",),
    },
}


async def main():
    target = Path.home() / "Downloads" / "LabMate_Runtime_QA"
    target.mkdir(parents=True, exist_ok=True)
    settings.REACT_TEMP_DIR = str(target / "workspaces")
    settings.SCREENSHOT_DIR = str(target / "screenshots")
    runtime = RuntimeEngine()
    capture = ScreenshotService()
    results = {}
    for language, sample in SAMPLES.items():
        result = await runtime.execute(
            sample["code"], language=language,
            filename=sample["filename"], stdin=sample["stdin"],
        )
        screenshots = []
        if result.success:
            for view in sample["views"]:
                ok, path, width, height = await capture.generate_screenshot(
                    sample["code"], result.output,
                    theme=language, username="Student", filename=sample["filename"],
                    stdin_data=sample["stdin"], input_echoed=language == "python",
                    view_mode=view,
                )
                screenshots.append({"view": view, "success": ok, "path": path, "width": width, "height": height})
        results[language] = {
            "success": result.success,
            "output": result.output,
            "error": result.error,
            "screenshots": screenshots,
        }
    (target / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
