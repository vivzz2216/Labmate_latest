"""
Pytest configuration for backend tests.
This file ensures the backend directory is in the Python path for imports.
"""
import sys
from pathlib import Path

# Add the backend directory to Python path so we can import 'app'
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

