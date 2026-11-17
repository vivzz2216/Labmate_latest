"""Deterministic requirements, capability gates and experiment-local evidence selection.

Code previews are presentations of source; only runner captures prove execution.
The planner never treats a zero exit code as proof of an unspecified output.
"""

import hashlib
import re

from PIL import Image
from .viewport_policy import responsive_requested


TEMPLATE_CATEGORIES = {
    "ubuntu": {"source":"source_preview","result":"ubuntu_desktop","available":True},
    "rstudio": {"source":"source_preview","result":"rstudio","available":True},
    "database": {"source":"source_preview","result":"database","available":True},
    "notebook": {"source":"source_preview","result":"notebook","available":True},
    "console": {"source": "source_preview", "result": "terminal", "available": True},
    "browser": {"source": "source_preview", "result": "browser", "available": True},
    "react": {"source": "source_preview", "result": "browser", "available": True},
    "api": {"source": "source_preview", "result": "http", "available": True},
    "java_awt": {"source": "source_preview", "result": "gui", "available": True},
    "java_swing": {"source": "source_preview", "result": "gui", "available": True},
    "javafx": {"source": "source_preview", "result": "gui", "available": False},
    "tkinter": {"source": "source_preview", "result": "gui", "available": True},
    "flask": {"source": "source_preview", "result": "browser", "available": True},
}


def experiment_category(language, objective="", code=""):
    language = {"c++": "cpp", "webdev": "html", "javascript": "node"}.get(language, language)
    text = objective + "\n" + code
    if language in {'ubuntu','bash','shell','unix'}:return 'ubuntu'
    if language in {'r','rstudio','rlang'}:return 'rstudio'
    if language=='sql':return 'database'
    if language in {'python', 'colab'} and re.search(r'\b(?:pyspark|torch|pytorch|tensorflow|keras)\b', text, re.I):return 'notebook'
    if language=='colab' or language=='python' and re.search(r'\b(?:colab|jupyter|deep\s+learning|neural\s+network|perceptron|autoencoder|backpropagation|cnn|rnn|lstm|mlp|gradient\s+descent|adam\s+optimizer|rmsprop)\b|\.ipynb\b',objective,re.I):return 'notebook'
    if language == "java":
        gui_terms=r'(?:graphical user interface|Java UI|GUI|JavaFX|Swing|AWT)'
        negated=r'\b(?:no|without|avoid|do\s+not\s+(?:use|create|build))\s+(?:an?\s+)?'+gui_terms+r'\b(?:\s*(?:,|or|and)\s*'+gui_terms+r'\b)*'
        requested=re.sub(negated,'',objective,flags=re.I)
        requested=re.sub(r'\b'+gui_terms+r'\s+(?:(?:is|are)\s+)?not\s+(?:required|needed)\b','',requested,flags=re.I)
        text=requested+'\n'+code
        for name, pattern in (("javafx", r"\bjavafx\b"), ("java_swing", r"\bswing\b|\bJ(?:Frame|Button|TextField)\b"),
                              ("java_awt", r"\bAWT\b|java\.awt")):
            if re.search(pattern, text, re.I):
                return name
        if re.search(r'\bGUI\b|graphical user interface|\bJava UI\b',requested,re.I):return 'java_swing'
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
    if language == "node" and re.search(r"\.listen\s*\(|\bHTTP\s+server\b|\bexpress\b|\bweb\s*(?:server|page|site)\b", text, re.I):
        return "browser" if re.search(r"\b(?:web\s*(?:page|site)|HTML\s+page|rendered\s+page)\b|<html\b", text, re.I) else "api"
    return "console"


def intermediate_states_required(objective):
    # Timing instructions in different sentences ("test before marking
    # verified ... capture after interaction") do not request two UI states.
    clauses=re.split(r'[.!?;\n]+',objective)
    if re.search(r'\binvalid\b.*\b(?:valid|successful)\b',objective,re.I|re.S):return True
    pair=r'\binvalid\b.*\b(?:valid|successful)\b|\bbefore\b.*\bafter\b'
    if any(re.search(pair,clause,re.I) for clause in clauses):return True
    def asks_for(state):
        return any(re.search(r'\b(?:capture|show|display|screenshots?|states?)\b.{0,80}\b'+state+r'\b|\b'+state+r'\b.{0,80}\b(?:states?|screenshots?|images?)\b',clause,re.I) for clause in clauses)
    return asks_for('before') and asks_for('after')


def _lines(text):
    """Lines with trailing blanks removed and surrounding empty lines dropped, so spacing at line ends never decides a result."""
    return "\n".join(line.strip() for line in str(text).replace("\r\n", "\n").split("\n")).strip("\n")


def strip_echoed_input(output, stdin):
    """The output without the lines the console echoed for input() (Python's runner shows typed input the way a terminal does)."""
    pending = [line.strip() for line in str(stdin or "").replace("\r\n", "\n").split("\n") if line.strip()]
    kept, position = [], 0
    for line in str(output).replace("\r\n", "\n").split("\n"):
        if position < len(pending) and line.strip() == pending[position]:
            position += 1
            continue
        kept.append(line)
    return "\n".join(kept)


def output_matches(actual, expected):
    """Whether the program output equals (or ends with) the manual's expected output.

    Extraction often flattens a multi-line expected block into one line with ' / ' between the lines, so the flattened form is
    expanded back into lines as well; a literal ' / ' inside a single line of output still matches as written.
    """
    actual = _lines(actual)
    for candidate in (expected, expected.replace(" / ", "\n")):
        candidate = _lines(candidate)
        if candidate and (actual == candidate or actual.endswith("\n" + candidate)):
            return True
    return False


def sql_results_match(actual, expected_lines):
    """Compare a SQL run's output with the result sets a manual lists.

    A run prints one table per query, each ended by a "(N row(s) returned)" line, so the manual's expected results are separate blocks,
    never one contiguous text. A caption line ("Inner join:") starts a new expected block whose first line is the column header and
    whose other lines are rows. Each block must equal the rows of one result set of the run, and blocks must appear in the manual's
    order. Row order inside a block is not compared: without ORDER BY SQL does not define it. Column headers are not compared either,
    since a manual rarely fixes aliases; the values are what an experiment is about."""
    squash = lambda text: re.sub(r"\s+", " ", str(text)).strip()
    caption = re.compile(r"[A-Za-z][^|]*:$")
    ignored = re.compile(r"^empty set$|^\((?:error|no rows)", re.I)
    blocks, header_next = [], True
    for raw in expected_lines:
        line = squash(raw)
        if not line:
            continue
        if caption.search(line):
            blocks.append([])
            header_next = True
            continue
        if ignored.search(line):
            continue
        if not blocks:
            blocks.append([])
        if header_next:
            header_next = False        # column header
            continue
        blocks[-1].append(line)
    blocks = [block for block in blocks if block]
    if not blocks:
        return True
    # Result sets of the run: the lines of each table between its dashed rule and its "(N row(s) returned)" line.
    sets, current, in_table = [], [], False
    for raw in str(actual).replace("\r\n", "\n").split("\n"):
        line = squash(raw)
        if re.fullmatch(r"-{3,}", line):
            in_table, current = True, []
        elif re.fullmatch(r"\(\d+ row\(s\) returned\)", line):
            if in_table:
                sets.append(sorted(current))
            in_table = False
        elif in_table and line:
            current.append(line)
    position = 0
    for block in blocks:
        wanted = sorted(block)
        while position < len(sets) and sets[position] != wanted:
            position += 1
        if position >= len(sets):
            return False
        position += 1
    return True


def distributed_output_matches(actual, expected_lines):
    """Distributed runs print timestamped log lines, and the output of several processes is merged in the order they ran, so the lines of one
    program are not one contiguous block. Every expected line must appear, in order, after the timestamps are removed."""
    strip = lambda line: re.sub(r"^\s*\[\d{1,2}:\d{2}:\d{2}(?:[.,]\d+)?\]\s*", "", str(line)).strip()
    have = [strip(line) for line in str(actual).replace("\r\n", "\n").split("\n")]
    position = 0
    for raw in expected_lines:
        line = strip(raw)
        if not line:
            continue
        try:
            position = have.index(line, position) + 1
        except ValueError:
            return False
    return True


_EXPECTED_HEAD = re.compile(r"(?:expected|sample)\s+(?:output|stdout)\s*(?:\([^)\n]*\))?\s*:\s*(.*)$", re.I)
# A line that starts the next part of a manual (a heading ending in a colon, or the input sample), ending an expected-output block.
_BLOCK_END = re.compile(
    r"^(?:(?:sample|expected)\s+input\b|experiment\b|"
    r"(?:(?:java|python|c|c\+\+|sql|r)\s+)?(?:program|code|solution|source\s+code|test\s+cases?(?:\s+and\s+expected\s+results)?|"
    r"requirements?|problem\s+statement|procedure|algorithm|conclusion|observations?|viva(?:\s+questions)?|evidence\s+to\s+submit|"
    r"verification\s+checklist)\s*:\s*$)", re.I)


def expected_outputs(objective):
    """Expected output lines named in the experiment text.

    "Expected output: text" on one line gives that text. A label with nothing after it ("Expected output (sample):") is followed by
    the lines of the expected output, up to the next heading, so a manual that lists the output below its label is verified too.
    """
    lines = str(objective).split("\n")
    found, index = [], 0
    while index < len(lines):
        match = _EXPECTED_HEAD.search(lines[index])
        if match:
            first = match.group(1).strip().strip('"\'`')
            if first:
                found.append(first)
            else:
                follow = index + 1
                while follow < len(lines) and lines[follow].strip() and not _BLOCK_END.match(lines[follow].strip()):
                    found.append(lines[follow].strip())
                    follow += 1
                index = follow - 1
        index += 1
    return found


def plan_experiment(objective, language, code=""):
    category = experiment_category(language, objective, code)
    config = TEMPLATE_CATEGORIES[category]
    expected = expected_outputs(objective)
    interaction = bool(re.search(r"\b(click|button|submit|validation|calculator|interactive|toggle|search|filter|to.do)\b", objective, re.I))
    requirements = [{"id": "source", "description": "Relevant source implementation", "evidence": "source_preview"},
                    {"id": "execution", "description": "Actual execution or rendered application", "evidence": config["result"]}]
    if interaction and category in {"browser", "react", "flask", "java_awt", "java_swing", "javafx", "tkinter"}:
        requirements.append({"id": "interaction", "description": "Required interaction changes the visible state", "evidence": config["result"]})
    responsive = responsive_requested(objective)
    if responsive:
        requirements.append({"id": "responsive", "description": "Both mobile and desktop layout evidence", "evidence": "browser"})
    intermediate = intermediate_states_required(objective)
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
    if database and category!='database':
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
    for name,count in plan.get('complete_source_lines',{}).items():
        spans=sorted((a,b) for item in selected if item['kind']=='source_preview' and item.get('source_file')==name
                     for a,b in item.get('source_ranges',[]))
        cursor=1
        for start,end in spans:
            if start>cursor:break
            cursor=max(cursor,end+1)
        if cursor<=count:missing.append('source_lines:'+name)
    return {"selected": selected, "redundant": redundant, "invalid": invalid, "missing_requirements": missing}


def verification_summary(plan, success, output, browser_verification=None, viewports=None, stdin=None):
    checks = {"execution": "passed" if success else "failed", "output": "not_specified",
              "render": "not_applicable", "interaction": "not_required"}
    failures = []
    from .semantic_checks import semantic_failures
    semantic = semantic_failures(plan.get('objective',''), output, plan.get('language',''))
    if semantic:
        failures.extend(semantic)
        checks['output']='failed'
    if plan['category']=='rstudio' and (browser_verification or {}).get('status')!='passed':
        failures.append('Real R execution and RStudio workspace evidence did not pass.')
    if plan['category']=='ubuntu':
        ubuntu=browser_verification or {}
        checks['execution']=ubuntu.get('execution_status',checks['execution'])
        checks['native_capture']=ubuntu.get('capture_status','unverified')
        checks['requirements']=ubuntu.get('requirements_status','unverified')
        if ubuntu.get('status')!='passed':
            if checks['execution']=='passed' and checks['native_capture']=='passed':
                failures.append('Permitted commands and native captures passed; the listed experiment requirements remain unverified.')
            else:failures.append('Real Ubuntu execution and native terminal/editor evidence did not pass.')
    if not plan["supported"]:
        failures.append(f"{plan['category']} has no isolated execution and capture adapter.")
    failed_check = re.search(
        r'(?im)^\s*(?:CHECK\s+FAILED\b|FAIL(?:ED)?\s*:\s*(?!expected\b)|'
        r'CHECK[^\n]*\s(?:->|\])\s*FAIL\b|[^\n]*\bmatch\s*[:=]\s*false\s*$)',
        output or '',
    )
    if plan["expected_output"]:
        actual = strip_echoed_input(output, stdin).rstrip() if stdin and plan.get("language") == "python" else output.replace("\r\n", "\n").rstrip()
        expected = "\n".join(plan["expected_output"])
        descriptive_expected = bool(
            re.search(
                r"\b(?:printed|showing|demonstrat\w*|accurately|console\s+log|received\s+response|loss\s+curve|accuracy|subclass\s+overrides|format|displayed)\b",
                expected,
                re.I,
            )
        )
        if plan['category'] in {'java_awt','java_swing','flask','tkinter'}:
            observed='\n'.join(str(t.get('observed_text','')) for t in (browser_verification or {}).get('tests',[]) if t.get('status')=='passed')
            def present(value):
                return bool(re.search(r'(?<![\w.+-])'+re.escape(value)+r'(?![\w.])',observed)) if re.fullmatch(r'-?\d+(?:\.\d+)?',value) else value in observed
            checks['output']='passed' if all(present(value) for value in plan['expected_output']) else 'failed'
        elif descriptive_expected:
            checks["output"] = "unverified" if actual else "failed"
        elif plan.get("language") == "sql":
            checks["output"] = "passed" if sql_results_match(actual, plan["expected_output"]) else "failed"
        elif plan.get("language") == "distributed":
            checks["output"] = "passed" if distributed_output_matches(actual, plan["expected_output"]) else "failed"
        else:
            checks["output"] = "passed" if output_matches(actual, expected) else "failed"
        if checks["output"] == "failed":
            failures.append("Actual output does not contain the explicit expected output from the manual.")
    # A single-program simulation (token ring, election, clocks, ...) is verified by its exact expected output. Programs that must really talk
    # over sockets, RMI or between processes also need the independent behaviour check, since printed text alone does not prove the exchange.
    networked = bool(re.search(r"\b(?:sockets?|rmi|server|client|ports?|registry|datagram|tcp|udp)\b", str(plan.get("objective", "")), re.I))
    if plan.get("language") == "distributed" and networked and (browser_verification or {}).get("status") != "passed":
        # Printed text alone does not prove a real exchange: such a run is at most "execution tested", never "verified".
        checks["behavior"] = "unverified"
    if failed_check:
        checks["output"] = "failed"
        failures.append("Program output reported a failed internal or verification check.")
    if plan["category"] in {"browser", "react", "flask", "java_awt", "java_swing", "tkinter"}:
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
        checks["database"] = 'passed' if (browser_verification or {}).get('kind')=='database' and browser_verification.get('status')=='passed' else 'unverified'
        if checks['database']!='passed':
            failures.append("Required database behavior has not been verified.")
            for db_fail in (browser_verification or {}).get("failures") or []:
                if db_fail not in failures:
                    failures.append(db_fail)
    if semantic: checks['output']='failed'
    return {"checks": checks, "failures": failures,
            "status": "failed" if failures or not success else "verified" if (checks["output"] == "passed" and checks.get("behavior") != "unverified") or checks["interaction"] == "passed" or checks.get("database") == "passed" else "execution_tested"}
