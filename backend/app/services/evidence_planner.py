"""Deterministic requirements, capability gates and experiment-local evidence selection.

Code previews are presentations of source; only runner captures prove execution.
The planner never treats a zero exit code as proof of an unspecified output.
"""

import hashlib
import re

from PIL import Image


TEMPLATE_CATEGORIES = {
    "console": {"source": "source_preview", "result": "terminal", "available": True},
    "browser": {"source": "source_preview", "result": "browser", "available": True},
    "react": {"source": "source_preview", "result": "browser", "available": True},
    "api": {"source": "source_preview", "result": "http", "available": True},
    "java_awt": {"source": "source_preview", "result": "gui", "available": True},
    "java_swing": {"source": "source_preview", "result": "gui", "available": True},
    "javafx": {"source": "source_preview", "result": "gui", "available": False},
    "tkinter": {"source": "source_preview", "result": "gui", "available": False},
    "flask": {"source": "source_preview", "result": "browser", "available": True},
}


def experiment_category(language, objective="", code=""):
    language = {"c++": "cpp", "webdev": "html", "javascript": "node"}.get(language, language)
    text = objective + "\n" + code
    if language == "java":
        for name, pattern in (("javafx", r"\bjavafx\b"), ("java_swing", r"\bswing\b|\bJ(?:Frame|Button|TextField)\b"),
                              ("java_awt", r"\bAWT\b|java\.awt")):
            if re.search(pattern, text, re.I):
                return name
        if re.search(r'\bGUI\b|graphical user interface|\bJava UI\b',text,re.I):return 'java_swing'
    if language == "python":
        if re.search(r"\btkinter\b|\bTk\s*\(", text, re.I):
            return "tkinter"
        if re.search(r"\bflask\b", text, re.I):
            return "flask"
    if language == "html":
        return "browser"
    if language == "react":
        return "react"
    if language == "node" and re.search(r"\bREST\b|\bAPI\b|\.json\s*\(|application/json", text, re.I):
        return "api"
    if language == "node" and re.search(r"\.listen\s*\(|\bHTTP\s+server\b|\bweb\s*(?:server|page|site)\b", text, re.I):
        return "browser"
    return "console"


def plan_experiment(objective, language, code=""):
    category = experiment_category(language, objective, code)
    config = TEMPLATE_CATEGORIES[category]
    expected = []
    for match in re.finditer(r"(?:expected\s+output|expected\s+stdout)\s*:\s*([^\n]+)", objective, re.I):
        expected.append(match.group(1).strip().strip('"\'`'))
    interaction = bool(re.search(r"\b(click|button|submit|validation|calculator|interactive|toggle|search|filter|to.do)\b", objective, re.I))
    requirements = [{"id": "source", "description": "Relevant source implementation", "evidence": "source_preview"},
                    {"id": "execution", "description": "Actual execution or rendered application", "evidence": config["result"]}]
    if interaction and category in {"browser", "react", "flask", "java_awt", "java_swing", "javafx", "tkinter"}:
        requirements.append({"id": "interaction", "description": "Required interaction changes the visible state", "evidence": config["result"]})
    responsive = bool(re.search(r"\bresponsive\b|\bmobile\b.*\bdesktop\b", objective, re.I))
    if responsive:
        requirements.append({"id": "responsive", "description": "Both mobile and desktop layout evidence", "evidence": "browser"})
    intermediate = bool(re.search(r"\binvalid\b.*\b(?:valid|successful)\b|\bbefore\b.*\bafter\b", objective, re.I | re.S))
    if intermediate and category in {"browser", "react", "flask", "java_awt", "java_swing", "javafx", "tkinter"}:
        requirements.append({"id": "intermediate", "description": "Distinct required intermediate and final states", "evidence": config["result"], "minimum_count": 2})
    database = bool(re.search(r"\bdatabase\b|\bSQL\b", objective, re.I))
    if re.search(r'\bdatabase\s+(?:is\s+)?optional\b|\bno database (?:is )?required\b', objective, re.I) and not re.search(r'\b(?:SQL|query|queries)\b', objective, re.I):
        database = False
    if database:
        requirements.append({"id": "database", "description": "Actual database query and result evidence", "evidence": "database"})
    uncertainty = []
    if not expected and category == "console":
        uncertainty.append("The manual provides no explicit expected output; successful execution does not establish correctness.")
    if database:
        uncertainty.append("No database experiment adapter is configured; database evidence must not be invented.")
    return {"version": 1, "objective": objective[:15000], "language": language, "category": category,
            "supported": config["available"], "requirements": requirements, "expected_output": expected,
            "expected_states": ["after required interactions"] if interaction else ["final execution state"],
            "recommended_screenshots": [config["source"], config["result"]],
            "intermediate_required": intermediate,
            "responsive_required": responsive, "uncertainties": uncertainty}


def select_evidence(plan, candidates):
    """Deduplicate exact pixels only within an experiment and evidence kind."""
    selected, redundant, invalid, seen = [], [], [], set()
    for item in candidates:
        try:
            with Image.open(item["path"]) as image:
                image.load()
                if image.width < 160 or image.height < 80:
                    raise ValueError("Screenshot is too small for legible evidence.")
                key = (item["kind"], hashlib.sha256(image.convert("RGB").tobytes()).hexdigest())
                if key in seen:
                    redundant.append({**item, "reason": "Duplicate pixels for the same evidence kind in this experiment."})
                    continue
                seen.add(key)
                selected.append({**item, "width": image.width, "height": image.height,
                                 "format": image.format, "authenticity": "rendered_source_preview" if item["kind"] == "source_preview"
                                 else "formatted_execution_transcript" if item["kind"] in {"terminal", "http"} else "actual_application_capture"})
        except (OSError, ValueError, KeyError) as error:
            invalid.append({**item, "reason": str(error)[:200]})
    kinds = {item["kind"] for item in selected}
    missing = [requirement["id"] for requirement in plan["requirements"]
               if sum(item["kind"] == requirement["evidence"] for item in selected) < requirement.get("minimum_count", 1)]
    captured_source_files={item.get('source_file') for item in selected if item['kind']=='source_preview'}
    missing += ['source:'+name for name in plan.get('required_source_files',[]) if name not in captured_source_files]
    return {"selected": selected, "redundant": redundant, "invalid": invalid, "missing_requirements": missing}


def verification_summary(plan, success, output, browser_verification=None, viewports=None):
    checks = {"execution": "passed" if success else "failed", "output": "not_specified",
              "render": "not_applicable", "interaction": "not_required"}
    failures = []
    if not plan["supported"]:
        failures.append(f"{plan['category']} has no isolated execution and capture adapter.")
    if plan["expected_output"]:
        actual = output.replace("\r\n", "\n").rstrip()
        expected = "\n".join(plan["expected_output"])
        if plan['category'] in {'java_awt','java_swing','flask'}:
            observed='\n'.join(str(t.get('observed_text','')) for t in (browser_verification or {}).get('tests',[]) if t.get('status')=='passed')
            def present(value):
                return bool(re.search(r'(?<![\w.+-])'+re.escape(value)+r'(?![\w.])',observed)) if re.fullmatch(r'-?\d+(?:\.\d+)?',value) else value in observed
            checks['output']='passed' if all(present(value) for value in plan['expected_output']) else 'failed'
        else:checks["output"] = "passed" if actual == expected or actual.endswith("\n" + expected) else "failed"
        if checks["output"] == "failed":
            failures.append("Actual output does not contain the explicit expected output from the manual.")
    if plan["category"] in {"browser", "react", "flask", "java_awt", "java_swing"}:
        checks["render"] = "passed" if success else "failed"
        required = any(r["id"] == "interaction" for r in plan["requirements"]) or bool((browser_verification or {}).get("required"))
        if required:
            checks["interaction"] = (browser_verification or {}).get("status", "unverified")
            if checks["interaction"] != "passed":
                failures.append("Required browser interactions have not passed verification.")
    if plan["category"] == "api":
        checks["http"] = "passed" if (browser_verification or {}).get("kind") == "http" and browser_verification.get("status") == "passed" else "unverified"
        if checks["http"] != "passed":
            failures.append("Required HTTP request/response behavior has not passed verification; console output is insufficient.")
    if plan['category'] in {'java_awt','java_swing'} and ((browser_verification or {}).get('kind')!='gui' or browser_verification.get('status')!='passed'):
        checks['gui']='unverified';failures.append('Actual Java UI controls and captured component states have not passed verification.')
    if plan["responsive_required"]:
        widths = [v.get("width", 1366) for v in (viewports or [])]
        checks["responsive"] = "passed" if any(w <= 480 for w in widths) and any(w >= 1024 for w in widths) else "unverified"
        if checks["responsive"] != "passed":
            failures.append("Mobile and desktop states have not both been captured.")
    if any(r["id"] == "database" for r in plan["requirements"]):
        checks["database"] = "unverified"
        failures.append("Required database behavior has not been verified.")
    return {"checks": checks, "failures": failures,
            "status": "failed" if failures or not success else "verified" if checks["output"] == "passed" or checks["interaction"] == "passed" else "execution_tested"}
