"""Lossless extraction of explicitly numbered experiments, without a model rewrite."""
import re

from .lab_question_filter import is_handwritten_question


HEADING = re.compile(r"^\s*(?:#+\s*)?experiment(?:\s*[-–—]\s*|\s+)(\d{1,3})\s*(?:[:.)–—-]\s*|\s+|$)(.*)$", re.I)
END = re.compile(r"^(?:research basis|references|bibliography|appendix)\b", re.I)
SECTION = re.compile(r"^(?:aim|problem statement|tasks|evidence to submit|verification checklist|result|difficulty)(?:\s*:.*)?$", re.I)
CONTENTS = re.compile(r"^(?:table\s+of\s+contents|contents|index)\s*:?\s*$", re.I)
FRONT_MATTER_END = re.compile(r"^(?:general\s+(?:requirements|instructions)|experiments)\s*:?\s*$", re.I)
REQUIREMENTS = re.compile(r"^(?:aim|problem statement|experiment question|requirements|tasks|expected output)\s*(?::.*)?$", re.I)
PAGE_REFERENCE = re.compile(r"(?:\.{2,}\s*|\s{2,}|\|\s*|\s+page\s+)\d+\s*$", re.I)


class ManualStructureError(ValueError):
    """Explicit boundaries are ambiguous; never silently fall back and lose tasks."""


def _body_boundaries(lines, boundaries):
    """Ignore compact entries only inside an explicitly labelled contents/index.

    Never deduplicate by experiment number: two actual problem statements with
    the same number must still fail rather than silently discard requirements.
    """
    in_contents = False
    previous = 0
    for position, (start, match) in enumerate(boundaries):
        for line in lines[previous:start]:
            if CONTENTS.fullmatch(line.strip()):
                in_contents = True
            elif FRONT_MATTER_END.fullmatch(line.strip()):
                in_contents = False
        end = boundaries[position + 1][0] if position + 1 < len(boundaries) else len(lines)
        entry = []
        for line in lines[start + 1:end]:
            if FRONT_MATTER_END.fullmatch(line.strip()):
                break
            if line.strip():
                entry.append(line.strip())
        has_requirements = any(REQUIREMENTS.fullmatch(line) for line in entry)
        compact_entry = not entry or all(PAGE_REFERENCE.search(line) for line in entry)
        if not (in_contents and not has_requirements and compact_entry):
            # Once the actual manual starts, a later 'Index' inside an exercise
            # must not make subsequent real sections disappear.
            return boundaries[position:]
        previous = start + 1
    return []


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
    raw_boundaries = [(i, HEADING.match(line)) for i, line in enumerate(lines) if HEADING.match(line)]
    if not raw_boundaries: return []
    boundaries = _body_boundaries(lines, raw_boundaries)
    if not boundaries:
        raise ManualStructureError("Only contents/index entries were found. Upload the experiment pages as well.")
    numbers = [int(match.group(1)) for _, match in boundaries]
    declared = re.search(r'\b(\d{1,3})\s+experiments\b', '\n'.join(lines[:boundaries[0][0]]), re.I)
    if declared and int(declared.group(1)) != len(boundaries):
        raise ManualStructureError(f"The manual declares {declared.group(1)} experiments, but {len(boundaries)} explicit experiment sections were found.")
    if len(numbers) != len(set(numbers)):
        repeated = sorted({number for number in numbers if numbers.count(number) > 1})
        raise ManualStructureError(
            "Multiple experiment sections use the same number: " + ", ".join(map(str, repeated))
            + ". Give distinct experiments unique numbers, or upload the original manual instead of a combined report."
        )
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
