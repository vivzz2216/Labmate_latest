"""Lossless extraction of explicitly numbered experiments, without a model rewrite."""
import re

from .lab_question_filter import is_handwritten_question, programming_lines


HEADING = re.compile(r"^\s*(?:#+\s*)?experiment(?:\s*[-–—]\s*|\s+)(?:(?:no|number)\.?\s*:?\s*)?(\d{1,3}[a-z]?)\s*(?:[:.)–—-]\s*|\s+|$)(.*)$", re.I)
END = re.compile(r"^(?:research basis|references|bibliography|appendix)\b", re.I)
SECTION = re.compile(r"^(?:aim|problem statement|tasks|evidence to submit|verification checklist|result|difficulty)(?:\s*:.*)?$", re.I)
CONTENTS = re.compile(r"^(?:table\s+of\s+contents|contents|index)\s*:?\s*$", re.I)
FRONT_MATTER_END = re.compile(r"^(?:general\s+(?:requirements|instructions)|experiments)\s*:?\s*$", re.I)
REQUIREMENTS = re.compile(r"^(?:aim|problem statement|experiment question|requirements|tasks|expected output)\s*(?::.*)?$", re.I)
PAGE_REFERENCE = re.compile(r"(?:\.{2,}\s*|\s{2,}|\|\s*|\s+page\s+)\d+\s*$", re.I)
QUESTION_HEADING = re.compile(r'^\s*(?:question|q)\s*([1-9]\d{0,2})\s*[:.)-]\s*(.*)$', re.I)
TASK_TITLE = re.compile(r"\b(?:write|wap|create|develop|implement|build|design|construct|perform|demonstrate|simulate)\b.{8,}", re.I)
QUESTION_END = re.compile(r'^(?:submission and verification|conclusion|references|bibliography)\s*$', re.I)


class ManualStructureError(ValueError):
    """Explicit boundaries are ambiguous; never silently fall back and lose tasks."""


def numbered_questions(text):
    """Preserve separate, explicitly labelled questions outside numbered experiments."""
    from .lab_question_filter import is_actionable_lab_question

    lines = text.splitlines()
    headings = [(i, match) for i, line in enumerate(lines)
                if (match := QUESTION_HEADING.match(line))]
    if len(headings) < 2:
        return []
    numbers = [int(match.group(1)) for _, match in headings]
    if len(numbers) != len(set(numbers)):
        raise ManualStructureError('Repeated question numbers were found. Remove duplicate/index headings before processing.')
    if numbers != list(range(numbers[0], numbers[0] + len(numbers))):
        raise ManualStructureError('Question numbers are missing or out of order. Review the manual before processing.')

    # Shared input data belongs to every question; a later task may depend on it.
    preface = lines[:headings[0][0]]
    default_language = manual_language_hint(preface) or "python"
    shared = []
    for index, line in enumerate(preface):
        if re.fullmatch(r'\s*Supplied data and constraints\s*', line, re.I):
            shared = [part.strip() for part in preface[index + 1:] if part.strip()]
            break
    tasks = []
    for index, (start, heading) in enumerate(headings):
        end = headings[index + 1][0] if index + 1 < len(headings) else len(lines)
        block = []
        for line in lines[start:end]:
            if QUESTION_END.fullmatch(line.strip()):
                break
            if line.strip():
                block.append(line.strip())
        body = '\n'.join(block)
        language = section_language(heading.group(2), body, default=default_language)
        if not is_actionable_lab_question(body, language):
            return []  # Leave non-programming question lists to the normal extractor.
        if shared:
            body += '\nSupplied data and constraints\n' + '\n'.join(shared)
        if len(body) > 15000:
            raise ManualStructureError(f'Question {numbers[index]} exceeds the supported length.')
        tasks.append({'id': numbers[index], 'text': body, 'language': language,
                      'extraction_method': 'original_numbered_question'})
    return tasks


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


# "7. Program/Code:" followed by a line that is only the language name, as manuals print it above the listing.
CODE_LABEL = re.compile(r"^[^\n]*\b(?:program|code|listing|source)\s*(?:/\s*code)?\s*:\s*\n\s*(C\+\+|CPP|C|Java)\s*$", re.I | re.M)
C_CODE = re.compile(r"^\s*#\s*include\s*<(?:stdio|stdlib|string|strings|math|ctype|unistd|fcntl|pthread|omp|time|limits|stdbool|stdint|signal|errno|semaphore|mpi|sys/[a-z_]+)\.h>", re.M)
CPP_CODE = re.compile(r"^\s*#\s*include\s*<(?:iostream|vector|string|algorithm|map|set|queue|stack|fstream|sstream|iomanip|list|deque|unordered_map|memory|stdexcept|exception|thread|mutex)>|\bstd::|\bcout\s*<<|\bcin\s*>>", re.M)
JAVA_CODE = re.compile(r"\bpublic\s+static\s+void\s+main\s*\(\s*String|\bSystem\.out\.print")


def declared_code_language(content):
    """The language a manual names on the line under its 'Program/Code:' heading (only C, C++ and Java are trusted here)."""
    match = CODE_LABEL.search(content or "")
    if not match:
        return None
    label = match.group(1).lower()
    return {"c": "c", "c++": "cpp", "cpp": "cpp", "java": "java"}[label]


def distributed_java_requested(text):
    return bool(re.search(r'\b(?:RMI|remote method invocation)\b', text, re.I)
                or (re.search(r'\bJava\b', text, re.I)
                    and re.search(r'\b(?:TCP|UDP|Distributed Computing Lab)\b', text, re.I))
                or len(set(re.findall(r'\b[\w$]+\.java\b', text, re.I))) > 1)


def section_language(title, content, default="python"):
    # Mixed React/Express is a full-stack Node assignment, never raw JSX in Node.
    text = title + "\n" + content
    if distributed_java_requested(text):
        return "distributed"
    if re.search(r'\b(?:Subject\s*:\s*UNIX\s+LAB|ITL\s*402)\b|^\s*#!\s*/(?:usr/)?bin/(?:ba)?sh\b',text,re.I|re.M):return 'ubuntu'
    if re.search(r'\b(?:UNIX|Ubuntu|Bash|shell script(?:s|ing)?|(?:sed|awk|grep|egrep|perl)\s+(?:script|program)(?:s|ming)?|system administrati(?:on|ve tasks))\b',title,re.I):return 'ubuntu'
    if re.search(r'\bR\s?Studio\b|\bRscript\b|\bR\s+(?:programming|language|lab|script)\b|\b(?:in|using|with|via)\s+(?-i:R)(?![\w.+#-])',title,re.I):return 'r'
    if re.search(r'\blanguage\s*:\s*R\s*(?:$|[;|])', content, re.M):
        return 'r'
    if re.search(r'\bflask\b', text, re.I):
        return 'python'
    if re.search(r'\bR\s?Studio\b|\bRscript\b|\bR\s+(?:programming|language|lab|script|environment|workspace|packages?)\b|\b(?:in|using|with|via)\s+(?-i:R)(?![\w.+#-])|\b(?:ggplot2|dplyr|tidyr|rpart|randomForest)\b', text, re.I) and not re.search(r'\b(?:python|colab|jupyter|pytorch|tensorflow|keras|pandas|numpy|scikit-learn|sklearn|flask|tkinter)\b', text, re.I):
        return 'r'
    if re.search(r'\b(?:SQL|MySQL|SQLite|DBMS|Structured Query Lab|Database Management Systems?)\b',title,re.I) and not re.search(r'\b(?:react|node|html|css|javascript|python|java|web|webpage|website|portfolio)\b',title,re.I):return 'sql'
    if re.search(r'\b(?:Colab|Jupyter|PySpark|SparkSession|SparkContext|PyTorch|TensorFlow|Keras|Data Science|Deep Learning|Neural Network|Machine Learning|Perceptron|Autoencoder|Backpropagation|MLP|ANN|LSTM|CNN|RNN|AdaBoost|Random Forest|Bayesian Network|Fuzzy Controller|Fuzzy Sets?|Classification Algorithms?)\b|\.ipynb\b', text, re.I): return 'colab'
    if re.search(r"\b(?:node(?:\.js)?|express)\b", title, re.I): return "node"
    if re.search(r"\breact\b", title, re.I): return "react"
    if re.search(r"\b(?:java|swing|awt|javafx)\b",title,re.I):return 'java'
    if re.search(r"\b(?:python|flask|tkinter)\b",title,re.I):return 'python'
    if re.search(r"\b(?:html5?|css3?|javascript|portfolio|registration)\b", title, re.I): return "html"
    # Titles often name the topic, not the language ("Quadratic Equation Roots", "Linked-List Stack ADT"). Before
    # guessing from words in the text, trust the language the manual labels its program with, then the code itself:
    # a C program used to fall through to python and a Java/JDBC program to sql (2026-11-20 audit).
    declared = declared_code_language(content)
    if declared: return declared
    if CPP_CODE.search(content): return "cpp"
    if C_CODE.search(content): return "c"
    if JAVA_CODE.search(content): return "java"
    if re.search(r'\b(?:SQL|MySQL|Structured Query Lab)\b', content, re.I): return 'sql'
    # Academic titles often name the concept rather than the language. Route
    # executable SQL and scientific Python to their actual supported runtimes.
    if re.search(r"\b(?:SELECT\s+.+\s+FROM|CREATE\s+(?:TABLE|VIEW|PROCEDURE|FUNCTION|TRIGGER)|(?:INNER|OUTER|LEFT|RIGHT)\s+JOIN)\b", content, re.I): return "sql"
    if re.search(r"^\s*(?:library\s*\(\s*(?:ggplot2|dplyr|tidyr)\b|[A-Za-z_.][\w.]*\s*<-\s*(?:data\.frame|c)\s*\()", content, re.M) and not re.search(r"\bdef\s+\w+\s*\(|\bimport\s+\w+", content): return "r"
    if re.search(r"\b(?:from|import)\s+(?:sklearn|pandas|numpy|pyspark|torch|tensorflow|keras)\b", content): return "colab"
    if re.search(r"\bc\+\+|\bcpp\b", text, re.I): return "cpp"
    if re.search(r"\bjava\b", text, re.I): return "java"
    if re.search(r"\bpython\b|\btkinter\b|\bflask\b", text, re.I): return "python"
    if re.search(r"\bc(?:89|90|99|11|17|18|23)?\s+(?:input|program(?:ming)?|language)\b", text, re.I): return "c"
    if re.search(r"\breact\b", text, re.I): return "react"
    if re.search(r"\b(?:html|css|javascript|browser)\b", text, re.I): return "html"
    if re.search(r'\b(?:write|execute|run)\s+(?:the\s+)?SQL\b',content,re.I):return 'sql'
    return default


def manual_language_hint(lines):
    """Use an explicit lab heading for exercises without their own language clues."""
    hints = set()
    for line in lines[:20]:
        if re.search(r'^\s*(?:subject|course|laboratory)\s*:', line, re.I) or re.search(
            r'\b(?:lab(?:oratory)?|manual)\s*$', line, re.I
        ):
            language = section_language(line, "", default=None)
            if language:
                hints.add(language)
    return next(iter(hints)) if len(hints) == 1 else None


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
    numbers = [match.group(1).upper() for _, match in boundaries]
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
    default_language = manual_language_hint(lines[:boundaries[0][0]]) or "python"
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
        if any(re.match(r"^(?:(?:\d+|[A-Z])[.)]\s*)?(?:lab(?:oratory)?\s+exercise|result\s*/\s*observation\s*/\s*program\s+code)\b", line, re.I) for line in block):
            # A handwritten theory subsection does not make the programming
            # exercise handwritten. Keep the aim, practical and post-lab tasks;
            # omit theory/cover material before applying question-level filters.
            block = programming_lines(block)
        body = "\n".join(block)
        if is_handwritten_question(body): continue
        objective_lines = [line for line in block[1:] if not SECTION.match(line) or re.match(
            r'^(?:aim|problem statement)\s*:\s*.*\b(?:write|build|create|implement|design|develop|print|execute|run|train|fit|import|evaluate|analyze|analyse|query|count|calculate|compute|find|sort|search|use|serve|render|classify|predict|visualize|visualise|construct|demonstrate|perform|plot|validate|display|test)\b',line,re.I)]
        if not objective_lines and TASK_TITLE.search(match.group(2)):
            # "Experiment 1: Write a Python program to ..." - the heading line is the whole problem statement.
            objective_lines = [match.group(2)]
        if not objective_lines:
            raise ManualStructureError(f"Experiment {match.group(1)} has no problem statement or requirements.")
        title=match.group(2).strip() or (block[1] if len(block)>1 else '')
        language=section_language(title,body,default=default_language)
        relevant_global=[line for line in global_lines if language=='node' or not re.search(r'For the Node\.js experiment',line,re.I)]
        if relevant_global:body += "\nGeneral requirements\n" + "\n".join(relevant_global)
        if len(body) > 15000: raise ManualStructureError(f"Experiment {match.group(1)} exceeds the supported question length.")
        results.append({"id": index + 1 if any(re.search(r"[A-Z]$", number) for number in numbers) else int(match.group(1)), "text": body,
                        "language": language,
                        "experiment_number": int(re.match(r"\d+", match.group(1)).group()), "experiment_label": match.group(1).upper(), "title": title or block[0],
                        "extraction_method": "original_numbered_section"})
    return results


_VIVA_SECTION_HEAD = re.compile(
    r"^\s*(?:#+\s*)?(?:\d+[.)]\s*)?(?:viva(?:\s*[-–]?\s*voce)?(?:\s+questions?)?|review\s+questions?|oral\s+questions?)\s*:?\s*(.*)$",
    re.I,
)
_VIVA_SECTION_END = re.compile(
    r"^\s*(?:#+\s*)?(?:\d+[.)]\s*)?(?:aim|objectives?|theory|procedure|implementation|algorithm|program|code|execution|output|"
    r"results?(?:\s*(?:and|&|/)\s*conclusions?)?|conclusions?(?:\s*(?:and|&|/)\s*results?)?|"
    r"references?|bibliography|submission|rubric|evaluation|appendix|experiment(?:\s*no\.?)?\s*\d+)\b\s*(?::.*)?$",
    re.I,
)
_ITEM_PREFIX = re.compile(r"^\s*(?:(?:q(?:uestion)?\s*)?\d+[.):\-]\s*|[-•*]\s+|[a-z][.)]\s+)", re.I)

_CONCLUSION_HEAD = re.compile(
    r"^\s*(?:#+\s*)?(?:\d+[.)]\s*)?(result\s*(?:and|&|/)\s*conclusion|conclusion\s*(?:and|&|/)\s*result|conclusions?|results?)\s*(?::|\s*$)\s*(.*)$",
    re.I,
)
_CONCLUSION_STOP = re.compile(
    r"^\s*(?:#+\s*)?(?:\d+[.)]\s*)?(?:viva(?:\s*[-–]?\s*voce)?(?:\s+questions?)?|review\s+questions?|references?|bibliography|"
    r"post[- ]?experiment(?:al)?|rubric|evaluation|marks|grade|signature|experiment(?:\s*no\.?)?\s*\d+)\b",
    re.I,
)
_PLACEHOLDER_LINE = re.compile(r"^[_\.\-\s\[\]()]{3,}$|^\[(?:write|enter|add)\b[^\]]*\]$", re.I)


def extract_viva_questions(text: str) -> list[str]:
    """Extract Viva / Viva-Voce questions from the uploaded manual text as a clean ordered list."""
    items: list[str] = []
    seen: set[str] = set()
    inside = False
    current = ""

    def flush():
        nonlocal current
        cleaned = re.sub(r"\s+", " ", current).strip()
        current = ""
        if len(cleaned) >= 6 and not _PLACEHOLDER_LINE.match(cleaned):
            key = cleaned.lower()
            if key not in seen:
                seen.add(key)
                items.append(cleaned)

    for raw in str(text or "").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            if inside:
                flush()
            continue
        head_match = _VIVA_SECTION_HEAD.match(line)
        if head_match:
            flush()
            inside = True
            inline = _ITEM_PREFIX.sub("", head_match.group(1) or "").strip()
            if inline and len(inline) >= 6:
                current = inline
            continue
        if inside and _VIVA_SECTION_END.match(line):
            flush()
            inside = False
            continue
        if inside:
            if _ITEM_PREFIX.match(line):
                flush()
                current = _ITEM_PREFIX.sub("", line).strip()
            elif current:
                current += " " + line
            elif len(line) >= 6:
                current = line
    flush()
    return items


def extract_manual_conclusion(text: str) -> str:
    """Extract the original experiment's Result/Conclusion prose from manual text (e.g. PDF)."""
    candidates: list[tuple[int, str]] = []
    inside = False
    priority = 0
    lines_buf: list[str] = []

    def flush():
        nonlocal inside, lines_buf
        if inside and lines_buf:
            joined = "\n".join(lines_buf).strip()
            if len(joined) >= 12:
                candidates.append((priority, joined))
        inside = False
        lines_buf = []

    for raw in str(text or "").splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        if re.match(r"^\s*result\s*/\s*observation", line, re.I):
            flush()
            continue
        head_match = _CONCLUSION_HEAD.match(line)
        if head_match:
            flush()
            label = (head_match.group(1) or "").lower()
            priority = 2 if "conclusion" in label else 1
            inside = True
            inline = (head_match.group(2) or "").strip()
            if inline and not _PLACEHOLDER_LINE.match(inline):
                lines_buf.append(inline)
            continue
        if inside and _CONCLUSION_STOP.match(line):
            flush()
            continue
        if inside:
            if not _PLACEHOLDER_LINE.match(line):
                lines_buf.append(line)
    flush()
    if not candidates:
        return ""
    # A manual with several experiments has one Result/Conclusion each; keep all of them in order, not just the first
    # (2026-11-20 live check: a 4-experiment manual's report showed only Experiment 1's conclusion).
    best = max(priority for priority, _ in candidates)
    parts = list(dict.fromkeys(text for priority, text in candidates if priority == best))
    return "\n\n".join(parts)[:3000]
