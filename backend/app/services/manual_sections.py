"""Lossless extraction of explicitly numbered experiments, without a model rewrite."""
import re

from .lab_question_filter import is_handwritten_question


HEADING = re.compile(r"^\s*(?:#+\s*)?experiment\s+(\d{1,3})\s*(?:[:.)–—-]\s*|\s+|$)(.*)$", re.I)
END = re.compile(r"^(?:research basis|references|bibliography|appendix)\b", re.I)
SECTION = re.compile(r"^(?:aim|problem statement|tasks|evidence to submit|verification checklist|result|difficulty)(?:\s*:.*)?$", re.I)


class ManualStructureError(ValueError):
    """Explicit boundaries are ambiguous; never silently fall back and lose tasks."""


def section_language(title, content, default="python"):
    # Mixed React/Express is a full-stack Node assignment, never raw JSX in Node.
    text = title + "\n" + content
    if re.search(r"\b(?:node(?:\.js)?|express)\b", title, re.I): return "node"
    if re.search(r"\breact\b", title, re.I): return "react"
    if re.search(r"\b(?:java|swing|awt|javafx)\b",title,re.I):return 'java'
    if re.search(r"\b(?:python|flask|tkinter)\b",title,re.I):return 'python'
    if re.search(r"\b(?:html5?|css3?|javascript|portfolio|registration)\b", title, re.I): return "html"
    if re.search(r"\bc\+\+|\bcpp\b", text, re.I): return "cpp"
    if re.search(r"\bjava\b", text, re.I): return "java"
    if re.search(r"\bpython\b|\btkinter\b|\bflask\b", text, re.I): return "python"
    if re.search(r"\bc\s+(?:input|program|language)\b", text, re.I): return "c"
    if re.search(r"\breact\b", text, re.I): return "react"
    if re.search(r"\b(?:html|css|javascript|browser)\b", text, re.I): return "html"
    return default


def numbered_experiments(text):
    """Return complete original sections or fail on ambiguous/duplicate boundaries.

    Index entries such as '1. Portfolio' are not experiment headings. Explicit
    handwritten experiments are excluded deliberately, with no renumbering.
    """
    lines = text.splitlines()
    boundaries = [(i, HEADING.match(line)) for i, line in enumerate(lines) if HEADING.match(line)]
    if not boundaries: return []
    numbers = [int(match.group(1)) for _, match in boundaries]
    declared = re.search(r'\b(\d{1,3})\s+experiments\b', '\n'.join(lines[:boundaries[0][0]]), re.I)
    if declared and int(declared.group(1)) != len(boundaries):
        raise ManualStructureError(f"The manual declares {declared.group(1)} experiments, but {len(boundaries)} explicit experiment sections were found.")
    if len(numbers) != len(set(numbers)):
        raise ManualStructureError("Repeated experiment numbers were found. Remove duplicate/index headings before processing.")
    if len(boundaries) > 100: raise ManualStructureError("Assignments are limited to 100 experiments.")
    global_lines = []
    collecting = False
    for line in lines[:boundaries[0][0]]:
        if re.match(r"^general (?:requirements|instructions)\s*$", line, re.I): collecting = True; continue
        if collecting and re.match(r"^(?:index|contents|how to|experiments)\b", line, re.I): break
        if collecting and line.strip() and not re.search(r'\|.*\bPage \d+$',line):global_lines.append(line.strip())
    results = []
    for index, (start, match) in enumerate(boundaries):
        end = boundaries[index+1][0] if index+1 < len(boundaries) else len(lines)
        block = []
        for line in lines[start:end]:
            if END.match(line.strip()): break
            if line.strip(): block.append(line.strip())
        body = "\n".join(block)
        if is_handwritten_question(body): continue
        objective_lines = [line for line in block[1:] if not SECTION.match(line)]
        if not objective_lines:
            raise ManualStructureError(f"Experiment {match.group(1)} has no problem statement or requirements.")
        title=match.group(2).strip() or (block[1] if len(block)>1 else '')
        language=section_language(title,body)
        relevant_global=[line for line in global_lines if language=='node' or not re.search(r'For the Node\.js experiment',line,re.I)]
        if relevant_global:body += "\nGeneral requirements\n" + "\n".join(relevant_global)
        if len(body) > 15000: raise ManualStructureError(f"Experiment {match.group(1)} exceeds the supported question length.")
        results.append({"id": int(match.group(1)), "text": body,
                        "language": language,
                        "experiment_number": int(match.group(1)), "title": title or block[0],
                        "extraction_method": "original_numbered_section"})
    return results
