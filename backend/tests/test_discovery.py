"""
Test Discovery Script
Scans the codebase and identifies all modules/functions that need testing
"""
import os
import ast
import re
from pathlib import Path
from typing import List, Dict, Set


def find_python_files(directory: str) -> List[str]:
    """Find all Python files in directory"""
    python_files = []
    for root, dirs, files in os.walk(directory):
        # Skip test directories and __pycache__
        if 'tests' in root or '__pycache__' in root:
            continue
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    return python_files


def extract_functions_and_classes(file_path: str) -> Dict[str, List[str]]:
    """Extract all functions and classes from a Python file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        try:
            tree = ast.parse(f.read(), filename=file_path)
        except SyntaxError:
            return {"classes": [], "functions": []}
    
    classes = []
    functions = []
    
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            classes.append(node.name)
            # Also get methods
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    functions.append(f"{node.name}.{item.name}")
        elif isinstance(node, ast.FunctionDef):
            # Top-level functions
            if not any(isinstance(parent, ast.ClassDef) for parent in ast.walk(tree) 
                      if hasattr(parent, 'body') and node in getattr(parent, 'body', [])):
                functions.append(node.name)
    
    return {"classes": classes, "functions": functions}


def check_test_coverage(module_path: str, test_dir: str) -> Dict[str, bool]:
    """Check if a module has corresponding test file"""
    module_name = os.path.basename(module_path).replace('.py', '')
    test_file = f"test_{module_name}.py"
    
    # Check in all test subdirectories
    test_paths = [
        os.path.join(test_dir, 'unit', 'test_services', test_file),
        os.path.join(test_dir, 'unit', 'test_middleware', test_file),
        os.path.join(test_dir, 'unit', 'test_security', test_file),
        os.path.join(test_dir, 'integration', 'test_routers', test_file),
    ]
    
    has_test = any(os.path.exists(path) for path in test_paths)
    
    return {
        "has_test": has_test,
        "test_paths": [p for p in test_paths if os.path.exists(p)]
    }


def generate_test_report(app_dir: str = "app", test_dir: str = "tests") -> None:
    """Generate a report of what needs testing"""
    app_path = Path(app_dir)
    test_path = Path(test_dir)
    
    print("=" * 80)
    print("TEST COVERAGE DISCOVERY REPORT")
    print("=" * 80)
    print()
    
    # Find all Python files
    python_files = find_python_files(app_dir)
    
    # Organize by category
    services = [f for f in python_files if 'services' in f]
    routers = [f for f in python_files if 'routers' in f]
    middleware = [f for f in python_files if 'middleware' in f]
    security = [f for f in python_files if 'security' in f]
    others = [f for f in python_files if not any(x in f for x in ['services', 'routers', 'middleware', 'security'])]
    
    categories = {
        "Services": services,
        "Routers": routers,
        "Middleware": middleware,
        "Security": security,
        "Others": others
    }
    
    total_modules = 0
    tested_modules = 0
    total_functions = 0
    tested_functions = 0
    
    for category, files in categories.items():
        if not files:
            continue
            
        print(f"\n{category.upper()}")
        print("-" * 80)
        
        for file_path in sorted(files):
            rel_path = os.path.relpath(file_path, app_dir)
            module_name = os.path.basename(file_path).replace('.py', '')
            
            # Extract functions and classes
            items = extract_functions_and_classes(file_path)
            classes = items["classes"]
            functions = items["functions"]
            
            total_items = len(classes) + len(functions)
            total_functions += total_items
            
            # Check test coverage
            coverage = check_test_coverage(file_path, test_dir)
            has_test = coverage["has_test"]
            
            status = "✅" if has_test else "❌"
            total_modules += 1
            if has_test:
                tested_modules += 1
                tested_functions += total_items  # Assume tested if test file exists
            
            print(f"{status} {rel_path}")
            print(f"   Classes: {len(classes)} | Functions: {len(functions)}")
            if has_test:
                print(f"   Test: {coverage['test_paths'][0] if coverage['test_paths'] else 'Found'}")
            else:
                print(f"   Test: MISSING - Create test_{module_name}.py")
            print()
    
    # Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Total Modules: {total_modules}")
    print(f"Tested Modules: {tested_modules}")
    print(f"Untested Modules: {total_modules - tested_modules}")
    print(f"Coverage: {(tested_modules / total_modules * 100) if total_modules > 0 else 0:.1f}%")
    print()
    print(f"Total Functions/Classes: {total_functions}")
    print(f"Estimated Tested: {tested_functions}")
    print()


if __name__ == "__main__":
    generate_test_report()




