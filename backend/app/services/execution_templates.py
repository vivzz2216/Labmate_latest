from typing import Dict, Any


def _react_template() -> Dict[str, Any]:
    return {
        "image": "node:18",
        "files": {
            "package.json": """{
  "name": "lab-react-app",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "npm run dev",
    "dev": "vite --host 0.0.0.0 --port 3000"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0"
  }
}
""",
            "index.html": "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>React Lab</title></head><body><div id='root'></div><script type='module' src='/src/main.jsx'></script></body></html>",
            "src/main.jsx": "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\nReactDOM.createRoot(document.getElementById('root')).render(<App />);",
            "src/App.jsx": "{code}",
            "src/index.css": "body { font-family: Arial, sans-serif; margin: 0; padding: 1rem; }",
        },
        "setup": ["npm ci"],
        "run": ["npm run dev -- --host 0.0.0.0 --port 3000"],
        "is_server": True,
        "startup_wait": 25,
        "health_check_url": "http://localhost:3000",
        "exposed_port": 3000,
        "timeout": 120,
    }


def _node_template() -> Dict[str, Any]:
    return {
        "image": "node:18",
        "files": {
            "package.json": """{
  "name": "lab-node-app",
  "version": "1.0.0",
  "main": "server.js",
  "type": "commonjs",
  "scripts": { "start": "node server.js" },
  "dependencies": { "express": "^4.19.2" }
}
""",
            "server.js": "{code}",
        },
        "setup": ["npm ci --ignore-scripts"],
        "run": ["npm start"],
        "is_server": True,
        "startup_wait": 15,
        "health_check_url": "http://localhost:3000",
        "exposed_port": 3000,
        "timeout": 90,
    }


def _html_template() -> Dict[str, Any]:
    return {
        "image": "node:18",
        "files": {
            "index.html": "{code}",
        },
        "setup": [],
        "run": [],
        "is_server": False,
        "startup_wait": 0,
        "health_check_url": None,
        "exposed_port": None,
        "timeout": 30,
    }


TEMPLATES: Dict[str, Dict[str, Any]] = {
    "react": _react_template(),
    "node": _node_template(),
    "html": _html_template(),
}


def get_template(project_type: str) -> Dict[str, Any]:
    return TEMPLATES.get(project_type or "", {})

