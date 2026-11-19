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


def report_note(notes):
    return "Differs from the manual: " + " ".join(notes) if notes else ""
