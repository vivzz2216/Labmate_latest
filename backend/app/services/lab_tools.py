"""Tasks done in an outside tool (Power BI, Canva, ParseHub, Similarweb, Google Trends) rather than in code.

LabMate cannot run these tools, so such a task is not a program to generate. It becomes an evidence part: LabMate
writes the procedure and the student attaches their own screenshots (see assignment_workflow and docx_layout).
A task that also asks for a program (scraping, sentiment analysis, a chart in Python) stays a code task.
"""
import html
import re

# tool -> (pattern, [(slot id, slot label)])
TOOLS = {
    # The dataset comes first: LabMate loads it into its Power BI studio and builds the dashboard from it. The dashboard
    # slot is filled by that capture, or by the student's own screenshot when they made it in a real Power BI.
    "powerbi": (r"power\s*-?\s*bi\b", [("powerbi_dataset", "Dataset for the dashboard (CSV)"),
                                       ("powerbi_dashboard", "Power BI dashboard screenshot")]),
    "canva": (r"\bcanva\b", [("canva_poster", "Final poster or design"), ("canva_editor", "Canva editor while designing")]),
    "parsehub": (r"\bparse\s*hub\b", [("parsehub_project", "ParseHub project with the selected elements"),
                                      ("parsehub_result", "ParseHub run result or exported CSV")]),
    "similarweb": (r"\bsimilar\s*web\b", [("similarweb_snapshot", "Similarweb snapshot")]),
    "google_trends": (r"\bgoogle\s+trends\b", [("google_trends", "Google Trends comparison")]),
}
CERTIFICATE_SLOT = ("powerbi_certificate", "Course completion certificate")   # same id the SMA catalogue uses

# Words that mean the student must write or run a program, so the task is not purely an outside-tool task.
PROGRAMMING = re.compile(
    r"\b(?:write|implement|develop)\s+(?:a\s+|an\s+|the\s+)?(?:python|r|java|c\+\+|c|sql|javascript)?\s*(?:program|code|script|function|query)\b"
    r"|\b(?:python|pandas|numpy|matplotlib|seaborn|networkx|nltk|beautifulsoup|scikit|sklearn|jupyter|colab)\b"
    r"|\bsentiment\s+analysis\b|\bscrape\b|\bscraping\s+code\b|\bplot(?:s|ting)?\b|\bbar\s+graph\b",
    re.I)

SLOT_IDS = {slot for _, slots in TOOLS.values() for slot, _ in slots} | {CERTIFICATE_SLOT[0]}

CERTIFICATE_TASK = re.compile(r"\b(?:course|certificate)\b", re.I)
SECTION_LABEL = re.compile(r"^\s*(?:implementation|theory|task|activity|exercise|procedure)\s*[:\-]\s*", re.I)


def strip_section_label(text):
    """'Implementation: Create a dashboard...' -> 'Create a dashboard...' (extraction sometimes keeps the heading)."""
    # The manual text arrives HTML-escaped ("Google Trends &amp; Similarweb"); the report must read "&".
    text = SECTION_LABEL.sub("", html.unescape(str(text or ""))).strip()
    # ...or tags it at the end: "Explain the working of the Canva tool. (Theory)"
    return re.sub(r"\s*[\(\[](?:theory|implementation|practical|programming|code|viva)[\)\]](\s*[.:]?)\s*$", r"\1", text,
                  flags=re.I).strip()


def dedupe_certificate_slots(questions):
    """When the certificate is its own evidence part, the dashboard part does not ask for it a second time."""
    certificate_only = any(q.get("kind") == "evidence" and [s["id"] for s in q.get("evidence_slots", [])] == [CERTIFICATE_SLOT[0]]
                           for q in questions)
    if not certificate_only:
        return questions
    cleaned = []
    for q in questions:
        slots = q.get("evidence_slots") or []
        if q.get("kind") == "evidence" and len(slots) > 1:
            q = {**q, "evidence_slots": [s for s in slots if s["id"] != CERTIFICATE_SLOT[0]]}
        cleaned.append(q)
    return cleaned


# The deliverable is a screenshot of something made elsewhere, not code ("... and attach the screenshot of it").
SCREENSHOT_DELIVERABLE = re.compile(r"\battach\b[^.]{0,40}\b(?:screenshot|snapshot|screen\s*shot)s?\b", re.I)

# A task starts with an action verb ("Create a dashboard...", "Analyse competitors..."); a theory question about the same
# tool ("Explain the working of Similarweb", "What is Power BI?") does not, and stays a written answer.
TASK_START = re.compile(
    r"^\s*(?:(?:\d+|[a-z]|[ivxlcdm]+)[.):\-]\s*)?(?:then\s+|also\s+)?"
    r"(?:create|design|build|make|prepare|develop|analy[sz]e|compare|complete|use|using|perform|generate|export|collect|select|choose|join|enrol+|"
    r"gather|publish|set\s+up|draw|plot\s+in)\b", re.I)


def tool_task_slots(question_text, manual_text=""):
    """The screenshot slots for a task done in an outside tool, or [] when it is an ordinary (code or theory) task.

    manual_text is the whole manual: a certificate requirement is often a separate line that the extractor
    does not keep inside the dashboard task itself.
    """
    text = strip_section_label(question_text)
    if PROGRAMMING.search(text) or not TASK_START.match(text):
        return []
    if CERTIFICATE_TASK.search(text) and not re.search(r"\bdashboard|report\b", text, re.I):
        # "Join the Power BI course and attach the certificate": the certificate is the whole deliverable.
        return [{"id": CERTIFICATE_SLOT[0], "label": CERTIFICATE_SLOT[1]}]
    found = []
    for pattern, tool_slots in TOOLS.values():
        match = re.search(pattern, text, re.I)
        if match:
            found.append((match.start(), tool_slots))
    if not found and SCREENSHOT_DELIVERABLE.search(text):
        # "Create dashboard of any social media platform and attach the screenshot of it." names no tool; the manual
        # around it does (Power BI). Use it only when the manual names exactly one tool, so the choice is not a guess.
        in_manual = [tool_slots for pattern, tool_slots in TOOLS.values() if re.search(pattern, str(manual_text or ""), re.I)]
        if len(in_manual) == 1:
            found.append((0, in_manual[0]))
    if not found:
        return []
    # Slots follow the order in which the task mentions its tools.
    slots = [{"id": slot, "label": label} for _, tool_slots in sorted(found, key=lambda item: item[0]) for slot, label in tool_slots]
    uses_powerbi = any(slot["id"] == "powerbi_dashboard" for slot in slots)
    mentioned = re.search(r"\bcertificate\b", text, re.I) or (uses_powerbi and re.search(r"\bcertificate\b", str(manual_text or ""), re.I))
    if mentioned:
        slots.append({"id": CERTIFICATE_SLOT[0], "label": CERTIFICATE_SLOT[1]})
    return slots[:6]


def recover_tool_tasks(manual_text, questions):
    """Outside-tool tasks written in the manual that extraction did not return as evidence parts.

    The extraction model keeps programming and theory questions, so it may drop "Create a dashboard in Power BI" or file
    it as theory. The manual's own lines are read here instead, so such a task is never silently lost. A line already
    covered by an evidence part with the same tool slots is skipped. Returns new question dicts (ids continue the list).
    """
    covered = {slot["id"] for question in questions if question.get("kind") == "evidence" for slot in question.get("evidence_slots", [])}
    recovered = []
    for raw in str(manual_text or "").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not 20 <= len(line) <= 600:
            continue
        slots = tool_task_slots(line, manual_text)
        tool_slot_ids = {slot["id"] for slot in slots} - {CERTIFICATE_SLOT[0]}
        if not slots or tool_slot_ids <= covered:
            continue
        covered |= tool_slot_ids
        line = strip_section_label(re.sub(r"^(?:\d+|[a-z]|[ivxlcdm]+)[.):\-]\s*", "", line, flags=re.I))   # numbering, labels, &amp;
        recovered.append({"id": len(questions) + len(recovered) + 1, "text": line, "language": "theory", "is_theory": True,
                          "kind": "evidence", "evidence_slots": slots})
    return recovered
