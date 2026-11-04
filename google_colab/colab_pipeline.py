"""Compatibility entry point for the packaged notebook pipeline."""
import sys
from pathlib import Path
_backend = str(Path(__file__).resolve().parents[1] / "backend")
if _backend not in sys.path:
    sys.path.insert(0, _backend)
from app.services.colab_pipeline import (
    ColabPythonKernel, ColabExecutionQueue, render_and_capture_colab,
    format_natural_notebook_title, ensure_home_loan_dataset, synthesize_csv_from_code,
)
