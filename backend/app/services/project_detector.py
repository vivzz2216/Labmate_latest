import re
from typing import Dict, List, Optional, Tuple


class ProjectDetector:
    """
    Lightweight heuristic detector for common project types.
    Supports: html (vanilla), react, node (express), python (fallback).
    Returns a structured result with indicators and a minimal suggested file map.
    """

    def __init__(self) -> None:
        # Scope limited to web stacks: html/css/js, react, node/express
        self.patterns = {
            "react": [
                r"\bimport\s+React\b",
                r"from\s+['\"]react['\"]",
                r"ReactDOM\.render",
                r"useState\s*\(",
                r"useEffect\s*\(",
                r"jsx",
                r"<\s*div[^>]*>",
                r"create-react-app",
                r"react-router|BrowserRouter|Routes|Route",
            ],
            "node": [
                r"require\s*\(\s*['\"]express['\"]\s*\)",
                r"import\s+express",
                r"app\.listen\s*\(",
                r"module\.exports",
                r"__dirname",
                r"package\.json",
                r"npm\s+(start|run)",
            ],
            "html": [
                r"<!DOCTYPE html>",
                r"<html",
                r"<head>",
                r"<body>",
                r"document\.getElementById",
                r"addEventListener",
                r"querySelector",
                r"style\s*=",
            ],
        }

    def detect(
        self,
        document_text: str,
        code_blocks: Optional[List[str]] = None,
    ) -> Dict:
        """
        Detect project type from text and code blocks.
        Returns:
            {
              "type": "<react|node|html|python|unknown>",
              "confidence": float,
              "indicators": [matched strings],
              "suggested_files": {path: hint/placeholder}
            }
        """
        combined_text = document_text or ""
        for block in code_blocks or []:
            combined_text += f"\n{block or ''}"

        scores: Dict[str, Tuple[int, List[str]]] = {}
        for ptype, regexes in self.patterns.items():
            hits: List[str] = []
            for pat in regexes:
                if re.search(pat, combined_text, re.IGNORECASE | re.MULTILINE):
                    hits.append(pat)
            scores[ptype] = (len(hits), hits)

        # Pick best score
        best_type = "unknown"
        best_hits: List[str] = []
        best_score = 0
        for ptype, (count, hits) in scores.items():
            if count > best_score:
                best_type = ptype
                best_score = count
                best_hits = hits

        # Confidence: normalize by pattern count
        confidence = 0.0
        if best_type != "unknown" and best_score > 0:
            total = len(self.patterns.get(best_type, [])) or 1
            confidence = round(min(1.0, best_score / total + 0.3), 2)

        # If best_type is not one of the supported web stacks, mark unknown
        if best_type not in {"react", "node", "html"}:
            best_type = "unknown"
            confidence = 0.0
            best_hits = []

        suggested_files = self._suggest_files(best_type)

        return {
            "type": best_type,
            "confidence": confidence,
            "indicators": best_hits,
            "suggested_files": suggested_files,
        }

    def _suggest_files(self, project_type: str) -> Dict[str, str]:
        if project_type == "react":
            return {
                "package.json": '{"name":"lab","version":"1.0.0","private":true}',
                "src/App.jsx": "// React entry component placeholder",
                "src/index.js": "// ReactDOM.render entry",
                "public/index.html": "<!DOCTYPE html>",
            }
        if project_type == "node":
            return {
                "package.json": '{"name":"lab","version":"1.0.0","main":"server.js"}',
                "server.js": "// Express server placeholder",
            }
        if project_type == "html":
            return {
                "index.html": "<!DOCTYPE html>",
                "styles.css": "/* CSS placeholder */",
                "script.js": "// JS placeholder",
            }
        return {}


project_detector = ProjectDetector()

