"""Find where a generated experiment had to depart from the manual, so the report says so (2026-11-20 audit).

The live audit found results reported as "completed" that were not what the manual asked for: MNIST and IMDB trained on a
120-item offline stand-in (MNIST accuracy 53 % instead of the manual's 98.8 %), California Housing swapped for the diabetes
dataset, and an Android app turned into a Java console simulation. The only trace was a line of console output or a code
comment. These notes are surfaced in the workflow log and printed in the Word report under the experiment's heading.
"""
import re

# Printed by the notebook runner when keras.datasets.<name>.load_data() returns its offline stand-in (colab_worker.py).
OFFLINE_DATASET = re.compile(r"Note: this runtime is offline\. keras\.datasets\.(\w+)\.load_data\(\) returned a small built-in sample "
                             r"\((\d+) training and (\d+) test items\)")
# Printed by generated programs when they replace something the lab needs (rule in assignment_workflow's code instruction).
DECLARED = re.compile(r"^\s*SUBSTITUTION:\s*(.+?)\s*$", re.M)

GENERATION_RULE = (
    "\n9. SUBSTITUTIONS: If the exercise needs something this runtime cannot provide (an internet download or online dataset, "
    "a mobile/Android device or emulator, Docker, a cloud service, special hardware, or another program or tool), write the "
    "closest runnable equivalent and make its FIRST output line exactly 'SUBSTITUTION: <what the manual asked for> was replaced "
    "by <what this program does instead> because <reason>.' Never present a substitute as the real thing. Do not print this line "
    "when nothing was replaced."
)


def substitution_notes(output):
    """Plain-language notes, one per substitution, found in a program's output (deduplicated, in order)."""
    notes = []
    for match in OFFLINE_DATASET.finditer(str(output or "")):
        name, train, test = match.groups()
        notes.append(f"The {name} dataset could not be downloaded in the offline lab runtime, so a small built-in sample "
                     f"({train} training and {test} test items) was used. Accuracy and other results differ from the manual "
                     f"and from a run on the full dataset.")
    for match in DECLARED.finditer(str(output or "")):
        text = match.group(1).strip()
        if text:
            notes.append(text if text.endswith(".") else text + ".")
    seen, unique = set(), []
    for note in notes:
        if note not in seen:
            seen.add(note)
            unique.append(note)
    return unique[:5]


# Datasets the offline notebook runtime refuses to download (colab_worker.validate_cell), with the names manuals use.
DOWNLOAD_ONLY_DATASETS = {
    "fetch_california_housing": ("California Housing", r"california\s+housing|fetch_california_housing|MedHouseVal"),
    "fetch_20newsgroups": ("20 Newsgroups", r"20\s*news\s*groups|fetch_20newsgroups"),
    "fetch_lfw_people": ("Labeled Faces in the Wild (LFW)", r"\blfw\b|labeled\s+faces\s+in\s+the\s+wild|fetch_lfw_people"),
    "fetch_openml": ("OpenML", r"fetch_openml"),
}
REPLACEMENT_LOADER = re.compile(r"\b((?:load|fetch|make)_\w+)\s*\(")


def dataset_swap_notes(question, code):
    """A note when the manual names a download-only dataset and the generated code loads something else.

    The model is asked to print a SUBSTITUTION line, but it does not always do so (AI/ML Exp 2 replaced California Housing
    with the diabetes dataset and only said so in a code comment), so this check does not depend on it.
    """
    question, code = str(question or ""), str(code or "")
    notes = []
    for fetcher, (name, pattern) in DOWNLOAD_ONLY_DATASETS.items():
        if not re.search(pattern, question, re.I) or re.search(rf"\b{fetcher}\s*\(", code):
            continue
        used = [loader for loader in dict.fromkeys(REPLACEMENT_LOADER.findall(code)) if loader not in DOWNLOAD_ONLY_DATASETS]
        if not used:
            continue
        what = ", ".join(used[:3])
        notes.append(f"The manual's {name} dataset needs a download that the offline lab runtime blocks, so the program used "
                     f"{what} instead. Results differ from the manual.")
    return notes


def all_substitution_notes(output, question="", code=""):
    """Notes from the program's output and from the dataset check, without repeating a dataset the output already explains."""
    notes = substitution_notes(output)
    for note in dataset_swap_notes(question, code):
        name = note.split("The manual's ", 1)[1].split(" dataset", 1)[0]
        if not any(name.lower() in existing.lower() for existing in notes):
            notes.append(note)
    return notes[:5]


def report_note(notes):
    return "Differs from the manual: " + " ".join(notes) if notes else ""
