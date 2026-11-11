"""
Lab Catalog Router - provides public metadata and curriculum for all LabMate lab sections.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/labs", tags=["lab-catalog"])

LAB_CATALOG_DATA: List[Dict[str, Any]] = [
    {
        "slug": "deep-learning",
        "track": "deep_learning",
        "title": "Deep Learning Labs",
        "short_title": "Deep Learning",
        "tagline": "Neural network architectures, model training & high-resolution notebook reports",
        "description": "Dedicated execution and reporting environment for Deep Learning coursework with PyTorch 2.x, TensorFlow 2.x, and Keras 3.x.",
        "default_language": "colab",
        "badge": "Expanded Section",
        "accent_color": "#8b5cf6",
        "features": [
            "Full support for PyTorch 2.x, TensorFlow 2.15+ and Keras 3.x",
            "Automated convergence and metric plotting (Loss, Accuracy, Confusion Matrix)",
            "Strict framework validation — guarantees requested models are trained without silent fallback",
            "Dark & Light Colab high-resolution notebook captures",
        ],
        "experiment_count": 8,
    },
    {
        "slug": "distributed-computing",
        "track": "distributed",
        "title": "Distributed Computing Labs",
        "short_title": "Distributed Computing",
        "tagline": "Multi-process architectures, socket networks, Java RMI & consensus algorithms",
        "description": "Specialized execution and reporting engine for Distributed Systems practicals with Java multi-process coordination and concurrent terminal captures.",
        "default_language": "distributed",
        "badge": "New Dedicated Section",
        "accent_color": "#0ea5e9",
        "features": [
            "Multi-file Java source compilation with topological dependency resolution",
            "Concurrent execution of Server, Client, and Registry processes in isolated microVM sandbox",
            "Loopback network orchestration with automated dynamic port injection",
            "Support for Java Socket API (TCP/UDP), Java RMI, Multithreading, and Distributed Consensus",
        ],
        "experiment_count": 8,
    },
    {
        "slug": "python",
        "track": "python",
        "title": "Basic Python Programming Labs",
        "short_title": "Python",
        "tagline": "Core syntax, data structures, algorithms, and OOP exercises",
        "description": "Python programming practicals with IDLE or Jupyter style captures.",
        "default_language": "python",
        "accent_color": "#3b82f6",
        "features": [
            "IDLE editor and IDLE shell captures",
            "Automated unit testing & stdin simulation",
            "Standard university practical syllabus coverage",
        ],
        "experiment_count": 10,
    },
    {
        "slug": "java",
        "track": "java",
        "title": "Java Programming Labs",
        "short_title": "Java",
        "tagline": "Object-oriented programming, inheritance, interfaces & multithreading",
        "description": "Classic Java coursework formatted with Windows Notepad source code and Windows Command Prompt execution captures.",
        "default_language": "java",
        "accent_color": "#f97316",
        "features": [
            "JDK 17/21 compilation and execution",
            "Windows Notepad + Command Prompt captures",
        ],
        "experiment_count": 10,
    },
    {
        "slug": "c-cpp",
        "track": "cpp",
        "title": "C & C++ Programming Labs",
        "short_title": "C / C++",
        "tagline": "Pointers, memory management, data structures & STL",
        "description": "Procedural C and object-oriented C++ coursework rendered with Code::Blocks IDE styling and Command Prompt terminal output.",
        "default_language": "cpp",
        "accent_color": "#6366f1",
        "features": [
            "GCC/G++ 13+ native compilation",
            "Code::Blocks IDE source capture style",
        ],
        "experiment_count": 10,
    },
    {
        "slug": "web-development",
        "track": "web",
        "title": "Web Development Labs",
        "short_title": "Web Dev",
        "tagline": "HTML5, CSS3, modern JavaScript, React components & Node.js backends",
        "description": "Full-stack and frontend web coursework with VS Code source views and real headless browser renders.",
        "default_language": "html",
        "accent_color": "#10b981",
        "features": [
            "Full browser rendering via Playwright Chromium/Edge engine",
            "VS Code Dark Modern editor presentation",
        ],
        "experiment_count": 10,
    },
    {
        "slug": "sql",
        "track": "sql",
        "title": "SQL & Database Labs",
        "short_title": "SQL",
        "tagline": "DDL, DML, relational schemas, complex joins & aggregate queries",
        "description": "Database management practicals executed against real MySQL instances with Workbench result captures.",
        "default_language": "sql",
        "accent_color": "#ec4899",
        "features": [
            "Real MySQL 8.x database container execution",
            "MySQL Workbench capture style with query and tabular results",
        ],
        "experiment_count": 10,
    },
    {
        "slug": "colab",
        "track": "colab",
        "title": "Google Colab & Notebook Labs",
        "short_title": "Notebooks",
        "tagline": "Data science, exploratory analysis, visualization & machine learning notebooks",
        "description": "Jupyter and Google Colab notebook workflows with multi-cell execution and matplotlib/seaborn plots.",
        "default_language": "colab",
        "accent_color": "#f59e0b",
        "features": [
            "Jupyter / Colab multi-cell execution runtime",
            "Matplotlib, Seaborn, Pandas, and NumPy integration",
        ],
        "experiment_count": 10,
    },
]


@router.get("")
async def list_labs() -> List[Dict[str, Any]]:
    """List all available lab sections with metadata."""
    return LAB_CATALOG_DATA


@router.get("/{slug}")
async def get_lab_detail(slug: str) -> Dict[str, Any]:
    """Retrieve detailed lab section metadata by slug."""
    normalized = slug.lower().replace("_", "-")
    for category in LAB_CATALOG_DATA:
        if category["slug"] == normalized or category["track"].replace("_", "-") == normalized:
            return category
    raise HTTPException(status_code=404, detail=f"Lab category '{slug}' not found.")

