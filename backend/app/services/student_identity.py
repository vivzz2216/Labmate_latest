"""Keep a student's own name consistent in generated lab evidence."""

import re


_NAME_REQUEST = re.compile(r"\b(?:student(?:'s)?|your|my)\s+name\b|\bname\s+on\s+(?:the\s+)?report\b", re.I)
_NAME_PROMPT = re.compile(r"\b(?:enter|input|type)\s+(?:the\s+)?student(?:'s)?\s+name\b", re.I)
_INPUT_CALL = re.compile(r"\b(?:scanf|fgets|gets|getline|input|nextLine|next)\s*\(|\bcin\s*>>", re.I)
_OUTPUT_NAME = re.compile(r"(?im)^[ \t]*student[ \t]+name[ \t]*:[ \t]*([^\r\n]+)")
_HEADER_NAME = re.compile(r"(?im)^\s*(?:(?://|#|/\*|\*)\s*)?student\s+name\s*:\s*([^\r\n]+)")
_OUTPUT_REQUEST = re.compile(
    r"\b(?:print|display|show)\s+(?:the\s+)?(?:student(?:'s)?|your)\s+name\b|"
    r"\b(?:student(?:'s)?|your)\s+name\s+(?:on|in)\s+(?:the\s+)?(?:report|output)\b|"
    r"\b(?:report|output)\s+(?:should\s+|must\s+)?(?:include|show|display|print)\s+"
    r"(?:the\s+)?(?:student(?:'s)?|your)\s+name\b",
    re.I,
)


def _normal(name):
    return " ".join(str(name or "").split()).casefold()


def _requested(question, student_name):
    question = question or ""
    if re.search(r"\b(?:named|called)\s+[A-Z][a-z]+\b", question):
        return False  # Names explicitly specified by the assignment take priority.
    return bool(_NAME_REQUEST.search(question) and _normal(student_name) not in {"", "student", "user", "admin", "owner", "test user"})


def align_student_stdin(question, code, stdin_data, student_name):
    """Replace only a first, name-shaped sample input when name is the first prompt."""
    if not _requested(question, student_name) or not stdin_data:
        return stdin_data
    prompt = _NAME_PROMPT.search(code or "")
    first_input = _INPUT_CALL.search(code or "")
    if not prompt or not first_input:
        return stdin_data
    if prompt.start() > first_input.start() and first_input.group(0).lower() != "input(":
        return stdin_data
    lines = stdin_data.splitlines(keepends=True)
    if not lines or not re.fullmatch(r"[\w .'-]{1,100}", lines[0].strip(), re.UNICODE) or any(ch.isdigit() for ch in lines[0]):
        return stdin_data
    line_end = "\r\n" if lines[0].endswith("\r\n") else "\n" if lines[0].endswith("\n") else ""
    return str(student_name).strip() + line_end + "".join(lines[1:])


def student_identity_error(question, code, output, student_name):
    """Never mark a run verified when its own-student evidence names someone else."""
    if not _requested(question, student_name):
        return ""
    expected = _normal(student_name)
    headers = [match.group(1).strip().rstrip("*/ ") for match in _HEADER_NAME.finditer((code or "")[:2500])]
    if headers and expected not in {_normal(value) for value in headers}:
        return "The source header does not use the signed-in student's profile name."
    if not _OUTPUT_REQUEST.search(question or "") and not re.search(
        r"(?:printf|cout|print|System\.out\.print)[^\n]*student\s+name", code or "", re.I
    ):
        return ""
    names = [match.group(1).strip() for match in _OUTPUT_NAME.finditer(output or "")]
    if names and expected not in {_normal(value) for value in names}:
        return ("The program output uses a different student name. Use the full profile name "
                f"{student_name!r} and read spaces in that name; the sample stdin supplies it on its first line.")
    if not names and expected not in _normal(output):
        return "The program output does not show the signed-in student's profile name."
    return ""
