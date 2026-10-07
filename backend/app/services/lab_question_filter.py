"""Conservative, provider-independent filtering of actionable programming exercises."""

import re

SECTION = re.compile(r"^\s*(?:\d+[.)]\s*)?(?:theory(?:\s*&\s*viva)?|theoretical\s+concepts?|objectives?|outcomes?|expected\s+learning\s+outcomes?|viva(?:\s*voce)?|concepts?|review\s+questions|pre[- ]?lab\s+questions|examples?|suggested\s+(?:post[- ]?experiment\s+)?programs?|results?|conclusion|references?|hardware\s+requirements?|software\s+requirements?|apparatus|equipment|precautions?|procedure)\b(?:\s*(?:questions?|section|programs?))?(?:\s*[:.-].*)?\s*$", re.I)
THEORETICAL = re.compile(r"\b(?:theory\s+(?:question|section)|viva(?:\s*voce)?|objective\s+(?:question|section)|conceptual\s+question)\b|^\s*(?:\d+[.)]\s*)?(?:define|explain|discuss|describe|differentiate|compare|what\s+(?:is|are)|why\s+|list\s+the\s+(?:advantages|types)|state\s+(?:the|a))\b", re.I)
ACTION = re.compile(r"\b(?:write|create|develop|implement|build|design|execute|run|compile|debug|modify|demonstrate|construct|perform|generate|calculate|compute|find|display|print|read|sort|reverse|check|convert|simulate)\b|^(?:code|program)\b", re.I)
PROGRAM = re.compile(r"\b(?:program(?:ming)?|code|script|function|application|app|web\s*page|website|html|css|javascript|react|node(?:\.js)?|python|java|c\+\+|algorithm|array|matrix|file|linked\s+list|stack|queue|tree|factorial|fibonacci|palindrome|prime|number|string|loop|class|inheritance|exception|gui|sort(?:ing)?)\b", re.I)
EXPLICIT_PROGRAM = re.compile(r"\b(?:write|create|develop|implement|build)\s+(?:a\s+|an\s+)?(?:(?:python|java|c\+\+|c|html|react|node)\s+)?(?:program|code|script|application|web\s+page)\b", re.I)


HANDWRITTEN_REGEX = re.compile(
    r"\b(handwritten|hand[- ]written|by hand|write by hand|draw by hand|draw neatly|sketch|manual drawing)\b",
    re.I
)


def is_handwritten_question(text: str) -> bool:
    """Detect if a question or instruction explicitly requests handwritten work."""
    return bool(HANDWRITTEN_REGEX.search(str(text or "")))


def is_actionable_lab_question(text: str, language: str = "", excluded_section: bool = False) -> bool:
    question = str(text or "").strip()
    question = re.sub(r"^\s*(?:(?:q(?:uestion)?)[.\s]*)?(?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)[.):\-]\s*", "", question, flags=re.I)
    if not question or excluded_section or language.lower() in {"theory", "objective", "viva", "concept"}:
        return False
    if is_handwritten_question(question):
        return False
    if SECTION.match(question):
        return False
    # A request to explain concepts does not become actionable just because it mentions code.
    if THEORETICAL.search(question):
        return False
    return bool(ACTION.search(question) and PROGRAM.search(question))


def is_theory_question(text: str, language: str = "") -> bool:
    """Identify theoretical concepts, viva, or review questions that are NOT handwritten."""
    question = str(text or "").strip()
    if not question or is_handwritten_question(question) or SECTION.match(question):
        return False
    if language.lower() in {"theory", "viva", "concept"}:
        return True
    return bool(THEORETICAL.search(question))


def programming_lines(lines, mode: str = "code_only"):
    """Remove entire excluded sections until the next lab/experiment/program heading."""
    excluded = False
    output = []
    for line in lines:
        stripped = line.strip()
        if mode == "code_only":
            heading = re.sub(r"^section\s+[a-z0-9]+\s*[:.)-]\s*", "", stripped, flags=re.I)
            if re.match(r"^(?:theory|viva(?:\s+voce)?|objectives?|concepts?|review\s+questions)\b", heading, re.I) or SECTION.match(heading):
                excluded = True
                continue
            if re.match(r"^(?:lab(?:oratory)?\s+(?:programming\s+)?(?:exercises?|assignments?|tasks?|questions?)|programming\s+(?:tasks?|questions?)|practical\s+exercises?|exercises?|programs?|experiment\s*\d+|task\s*\d+)\b", heading, re.I):
                excluded = False
            elif excluded and re.match(r"^\s*\d+[.)]\s*(?:write|develop|implement|create|build)\b", stripped, re.I):
                continue
            if not excluded:
                output.append(line)
        else:
            # In theory_and_code mode, keep theory unless marked as handwritten
            if not is_handwritten_question(stripped):
                output.append(line)
    return output


def filter_lab_tasks(tasks, mode: str = "code_only"):
    result = []
    for task in tasks:
        text = task.get("question_text") or task.get("text") or ""
        language = task.get("detected_language") or task.get("language") or ""
        
        # If handwritten is mentioned anywhere, always exclude
        if is_handwritten_question(text):
            continue
            
        mixed_program = (mode == "theory_and_code" and EXPLICIT_PROGRAM.search(text) and
                         re.search(r"\b(?:and|then)\s+(?:write|create|develop|implement|build)\b", text, re.I))
        if mode == "theory_and_code" and language.lower() in {"theory", "viva", "concept", "objective"} and (is_actionable_lab_question(text, "") or mixed_program):
            detected = re.search(r"\b(c\+\+|python|java|react|html|node(?:\.js)?|c)\b", text, re.I)
            language = {"c++": "cpp", "node.js": "node"}.get(detected.group(1).lower(), detected.group(1).lower()) if detected else "python"
        if is_actionable_lab_question(text, language) or (mixed_program and language.lower() not in {"theory", "viva", "concept", "objective"}):
            clean = dict(task)
            clean["id"] = len(result) + 1
            clean["language"] = language or "python"
            clean["is_theory"] = False
            result.append(clean)
        elif mode == "theory_and_code" and is_theory_question(text, language):
            clean = dict(task)
            clean["id"] = len(result) + 1
            clean["language"] = "theory"
            clean["is_theory"] = True
            result.append(clean)
    return result
