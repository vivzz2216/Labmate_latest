from app.services.project_detector import project_detector


def test_detect_react_project():
    doc = "import React from 'react'; const App = () => <div>Hello</div>; useState()"
    res = project_detector.detect(doc, [doc])
    assert res["type"] == "react"
    assert res["confidence"] > 0.5
    assert any("react" in hit.lower() or "jsx" in hit.lower() for hit in res["indicators"])


def test_detect_node_express():
    doc = "const express = require('express'); const app = express(); app.listen(3000);"
    res = project_detector.detect(doc, [doc])
    assert res["type"] == "node"
    assert res["confidence"] > 0.3


def test_detect_html_vanilla():
    doc = "<!DOCTYPE html><html><body><script>document.getElementById('a')</script></body></html>"
    res = project_detector.detect(doc, [doc])
    assert res["type"] == "html"
    assert res["confidence"] > 0.2


def test_detect_python_fallback():
    doc = "def main():\n    print('hello world')"
    res = project_detector.detect(doc, [doc])
    assert res["type"] == "unknown"
    assert res["confidence"] == 0.0

