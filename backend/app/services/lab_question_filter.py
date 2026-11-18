"""Conservative, provider-independent filtering of actionable programming exercises."""

import re

SECTION = re.compile(r"^\s*(?:\d+[.)]\s*)?(?:theory(?:\s*&\s*viva)?|theoretical\s+concepts?|objectives?|outcomes?|expected\s+learning\s+outcomes?|viva(?:\s*voce)?|concepts?|review\s+questions|pre[- ]?lab\s+questions|examples?|suggested\s+(?:post[- ]?experiment\s+)?programs?|results?|conclusion|references?|hardware\s+requirements?|software\s+requirements?|apparatus|equipment|precautions?|procedure)\b(?:\s*(?:questions?|section|programs?))?(?:\s*[:.-].*)?\s*$", re.I)
THEORETICAL = re.compile(r"\b(?:theory\s+(?:question|section)|viva(?:\s*voce)?|objective\s+(?:question|section)|conceptual\s+question)\b|^\s*(?:\d+[.)]\s*)?(?:define|explain|discuss|describe|differentiate|compare|what\s+(?:is|are)|why\s+|list\s+the\s+(?:advantages|types)|state\s+(?:the|a))\b", re.I)
ACTION = re.compile(r"\b(?:write|create|develop|implement|build|design|execute|run|compile|debug|modify|demonstrate|construct|perform|generate|calculate|compute|find|display|print|read|sort|reverse|check|convert|simulate|evaluate|compare|apply|measure|train|fit|predict|classify|analyze)\b|^(?:code|program)\b", re.I)
PROGRAM = re.compile(r"\b(?:program(?:ming)?|code|script|function|application|app|web\s*page|website|html|css|javascript|react|node(?:\.js)?|python|java|c\+\+|algorithm|array|matrix|file|linked\s+list|stack|queue|tree|factorial|fibonacci|palindrome|prime|number|string|loop|class|inheritance|exception|gui|sort(?:ing)?|classifier|classification|metric|dataset|model)\b", re.I)
# Further task verbs, trusted only for a question the extraction model already labelled with a programming language.
# Without them "Count the null values in every column" or "WAP to swap two numbers" was silently dropped.
MODEL_TASK_ACTION = re.compile(r"\b(?:wap|count|save|store|load|import|export|swap|plot|draw|visuali[sz]e|insert|delete|update|"
                               r"search|merge|split|concatenate|filter|accept|input|show|list|handle|validate|connect|send|"
                               r"receive|query|select|fetch|clean|preprocess|transform|encode|tokeni[sz]e|scrape|parse|"
                               r"test|verify|install|configure|set\s+up|use|make|add|remove|replace|rename|copy|open|"
                               r"traverse|perform|initiali[sz]e|declare|access|deploy|summari[sz]e)\b", re.I)
CODE_LANGUAGES = {"html", "react", "node", "python", "java", "c", "cpp", "sql", "colab", "ubuntu", "distributed", "r"}
EXPLICIT_PROGRAM = re.compile(r"\b(?:write|create|develop|implement|build)\s+(?:a\s+|an\s+)?(?:(?:python|java|c\+\+|c|html|react|node)\s+)?(?:program|code|script|application|web\s+page)\b", re.I)


# Only Unix-labelled practical prompts override explanation filtering. Generic
# theory questions mentioning a shell or Linux remain theory.
UNIX_PRACTICAL = re.compile(
    r'\b(?:commands?\s+with\s+syntax\s+and\s+examples?|'
    r'(?:shell|perl|awk|sed)\s+scripts?|'
    r'(?:UNIX|Ubuntu)\s+(?:networking\s+)?commands?|'
    r'(?:install(?:ation)?|partition(?:ing)?)\b.{0,70}\b(?:Ubuntu|UNIX)|'
    r'(?:MAC|IP)\s+address)\b', re.I)


_HANDWRITTEN_SUBJECT = r"(?!\s+(?:digits?|characters?|letters?|numerals?|text|images?|signatures?|samples?|data(?:set)?s?|recognition)\b)"
HANDWRITTEN_REGEX = re.compile(
    r"\b(?:by hand|draw neatly|sketch|manual drawing|"
    r"(?:to be|must be|should be|is|are|please)\s+hand[- ]?written\b|"
    r"hand[- ]?written\s+(?:exercise|answers?|notes?|viva|questions?|submission|work)\b|"
    r"\(\s*hand[- ]?written\s*\))",
    re.I
)


def is_handwritten_question(text: str) -> bool:
    """Detect if a question or instruction explicitly requests handwritten work."""
    return bool(HANDWRITTEN_REGEX.search(str(text or "")))


def practical_text(text: str) -> str:
    """The part of an experiment a student has to program.

    A lab manual puts Theory, Learning Objectives and Viva-Voce sections around the program. Those headings
    describe the manual's layout; they must not make the whole experiment look theoretical.
    """
    lines = str(text or "").splitlines()
    if len(lines) < 2:
        return str(text or "")
    kept = programming_lines(lines)
    return "\n".join(kept) if kept else str(text or "")


def is_actionable_lab_question(text: str, language: str = "", excluded_section: bool = False) -> bool:
    question = str(text or "").strip()
    question = re.sub(r"^\s*(?:(?:q(?:uestion)?)[.\s]*)?(?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)[.):\-]\s*", "", question, flags=re.I)
    if not question or excluded_section or language.lower() in {"theory", "objective", "viva", "concept"}:
        return False
    if is_handwritten_question(question):
        return False
    if SECTION.match(question):
        return False
    if language.lower() == 'ubuntu' and UNIX_PRACTICAL.search(question):
        return True
    # A request to explain concepts does not become actionable just because it mentions code. Judge the
    # practical part only: a manual's "Viva-Voce Questions" section must not reject its programming task.
    if THEORETICAL.search(practical_text(question)):
        return False
    # A known lab language supplies context that valid UI task prose may omit.
    known_language = language.lower() in {"html", "react", "node", "python", "java", "c", "cpp", "sql", "colab", "ubuntu", "distributed", "r"}
    return bool(ACTION.search(question) and (PROGRAM.search(question) or known_language))


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
    practical = False
    post_lab = False
    output = []
    for line in lines:
        stripped = line.strip()
        if mode == "code_only":
            heading = re.sub(r"^section\s+[a-z0-9]+\s*[:.)-]\s*", "", stripped, flags=re.I)
            # Academic manuals number section headings independently of their
            # programming questions (7. Laboratory Exercise, B. Program Code).
            # Normalize headings only; keep the original source lines intact.
            heading = re.sub(r"^(?:\d+[.)]|[a-z][.)])\s*", "", heading, flags=re.I)
            if re.match(r"^experiment\s*[-–—]?\s*\d+\b", heading, re.I):
                practical = post_lab = False
            if re.match(r"^pre[- ]?experiment(?:al)?\s+(?:exercise|theory)\b", heading, re.I):
                excluded = True
                practical = False
                continue
            if re.match(r"^post[- ]?experiment(?:al|s)?\s+exercise\b", heading, re.I):
                excluded = True
                practical = False
                post_lab = not is_handwritten_question(heading)
                continue
            if re.match(r"^(?:brief|extended)\s+theory\b", heading, re.I):
                excluded = True
                continue
            # Academic manuals place the actual SQL/Python commands under
            # Laboratory Exercise -> Procedure. It is executable work here,
            # even though a procedure elsewhere is usually just setup prose.
            if practical and re.match(r"^procedure\b", heading, re.I):
                excluded = False
                output.append(line)
                continue
            if ((post_lab and re.match(r"^questions?\s*:?\s*$", heading, re.I)) or
                    re.match(r"^result\s*/\s*observation\s*/\s*program\s+code\b|^dataset\s*:", heading, re.I)):
                excluded = False
                practical = True
                output.append(line)
                continue
            if re.match(r"^(?:theory|viva(?:\s+voce)?|objectives?|concepts?|review\s+questions)\b", heading, re.I) or SECTION.match(heading):
                excluded = True
                continue
            if re.match(r"^(?:lab(?:oratory)?\s+(?:programming\s+)?(?:exercises?|assignments?|tasks?|questions?)|programming\s+(?:tasks?|questions?)|practical\s+exercises?|exercises?|programs?|experiment\s*[-–—]?\s*\d+|task\s*\d+)\b", heading, re.I):
                excluded = False
                if re.match(r"^(?:lab(?:oratory)?|practical)\s+", heading, re.I):
                    practical = True
            elif excluded and re.match(r"^\s*\d+[.)]\s*(?:write|develop|implement|create|build)\b", stripped, re.I):
                continue
            if not excluded:
                output.append(line)
        else:
            # In theory_and_code mode, keep theory unless marked as handwritten
            if not is_handwritten_question(stripped):
                output.append(line)
    return output


def model_labelled_task(text: str, language: str) -> bool:
    """A task the model filed under a programming language whose verb is outside ACTION (count, save, swap...)."""
    question = re.sub(r"^\s*(?:(?:q(?:uestion)?|step)[.\s]*)?(?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)[.):\-]\s*", "", str(text or "").strip(), flags=re.I)
    return bool(language.lower() in CODE_LANGUAGES and len(question) >= 12 and MODEL_TASK_ACTION.search(question)
                and not is_handwritten_question(question) and not SECTION.match(question)
                and not THEORETICAL.search(practical_text(question)))


def filter_lab_tasks(tasks, mode: str = "code_only", model_labelled: bool = False):
    """Keep actionable tasks. model_labelled: the tasks come from the extraction model, which already labelled each one."""
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
        if (is_actionable_lab_question(text, language) or (model_labelled and model_labelled_task(text, language))
                or (mixed_program and language.lower() not in {"theory", "viva", "concept", "objective"})):
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
