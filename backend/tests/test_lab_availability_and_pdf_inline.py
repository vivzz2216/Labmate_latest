"""2026-11-20: Ubuntu, Computer Networks, Power BI and Android Studio labs switched off on the live site, and screenshots placed
inside an uploaded PDF manual directly below each experiment's output when the instructions ask for it."""
import pytest

from app.config import settings
from app.services import lab_availability as availability
from app.services.instruction_policy import parse_instruction_preferences
from app.services.pdf_inline import locate_anchors


@pytest.fixture()
def restricted(monkeypatch):
    monkeypatch.setattr(settings, "UNAVAILABLE_LAB_TRACKS", "ubuntu,networks,powerbi,android")


def q(qid, text, language="python", **extra):
    return {"id": qid, "text": text, "language": language, **extra}


def test_restricted_experiments_are_left_out_and_the_rest_kept(restricted):
    questions = [
        q(1, "Experiment 1: Network Diagnostic Commands and Wireshark Packet Analysis", "ubuntu"),
        q(2, "Experiment 2: Cisco Packet Tracer Multi-Subnet Routing Simulation"),
        q(3, "Experiment 3: UDP Socket Simulation of DNS Resolution"),
        q(4, "Experiment 4: Android EMI Calculator Application", "java"),
        q(5, "Experiment 5: Build a Power BI dashboard of sales"),
        q(6, "Experiment 6: Introduction to Wireshark", "theory", studio="wireshark", kind="evidence"),
    ]
    kept, left_out = availability.split_available(questions)
    assert [item["id"] for item in kept] == [3]
    assert [(item["id"], track) for item, track in left_out] == [
        (1, "ubuntu"), (2, "networks"), (4, "android"), (5, "powerbi"), (6, "networks")]
    message = availability.left_out_message(left_out)
    assert "not available yet" in message and "Cisco Packet Tracer Multi-Subnet" in message


def test_a_manual_made_only_of_restricted_labs_stops_with_a_plain_message(restricted):
    with pytest.raises(availability.LabsUnavailableError, match="only contains Computer Networks labs"):
        availability.split_available([q(1, "Experiment 7: Introduction to Packet Tracer and Hub and Switch")])


def test_students_own_tool_screenshots_stay_available(restricted):
    sma_part = q(2, "Build a Power BI dashboard from the dataset", "theory", kind="evidence",
                 evidence_slots=[{"id": "dashboard", "label": "Your Power BI dashboard"}])
    assert availability.split_available([sma_part]) == ([sma_part], [])


def test_switch_off_list_is_configurable(monkeypatch):
    monkeypatch.setattr(settings, "UNAVAILABLE_LAB_TRACKS", "")
    linux = q(1, "Experiment 1: Shell scripting", "ubuntu")
    assert availability.split_available([linux]) == ([linux], [])
    assert availability.blocked_message([linux]) == ""
    monkeypatch.setattr(settings, "UNAVAILABLE_LAB_TRACKS", "ubuntu")
    assert "Ubuntu / Linux command labs" in availability.blocked_message([linux])


@pytest.mark.parametrize("text,expected", [
    ("Place the generated screenshot immediately below its corresponding experiment output or screenshot reference. "
     "Do not place screenshots randomly, at the end of the document, or under unrelated experiments.", True),
    ("Paste the screenshots under each question", True),
    ("put screenshots after the output of each program", True),
    ("Do not place screenshots under unrelated experiments.", False),
    ("Don't paste screenshots under each question.", False),
    ("Use Times New Roman 12 pt", False),
])
def test_placement_wording_is_recognised(text, expected):
    assert parse_instruction_preferences(text).paste_under_question is expected


LINES = [(0, 60, 70, "Volume 1: Python Programming Lab Manual"),
         (0, 130, 140, "Experiment 1: Fundamental Data Types, Object Identity, and"),
         (0, 200, 210, "7. Program/Code:"),
         (1, 50, 60, "for i in range(3): print(i)"),
         (1, 120, 130, "8. Sample Input and Output:"),
         (1, 150, 160, "1. Push 10"),
         (1, 423, 433, "9. Output References and Verification Notes: ids vary"),
         (1, 471, 481, "10. Result and Conclusion: verified."),
         (1, 590, 600, "Experiment 2: Strings, Lists, Tuples, and Dictionaries (Anagrams and"),
         (2, 40, 50, "7. Program/Code:"),
         (2, 300, 310, "Experiment 3: File Handling"),
         (2, 320, 330, "Write a program to copy a file.")]


def test_screenshots_go_below_the_output_and_its_references_not_inside_the_sample():
    results = [{"question": "Experiment 1: Fundamental Data Types, Object Identity, and\nmore"},
               {"question": "Experiment 2: Strings, Lists, Tuples, and Dictionaries (Anagrams and\nRoman"},
               {"question": "Experiment 3: File Handling\nWrite a program"},
               {"question": "Experiment 9: Not in this manual"}]
    anchors = locate_anchors(LINES, results)
    assert LINES[anchors[0]][3].startswith("10. Result and Conclusion")      # after sample output and its references
    assert LINES[anchors[1]][3].startswith("Experiment 3")                     # no output section: before the next experiment
    assert anchors[2] == len(LINES)                                            # last experiment: after the final page
    assert 3 not in anchors                                                    # not found: stays in the results section


def test_a_reworded_question_is_still_found_by_its_experiment_number():
    anchors = locate_anchors(LINES, [{"question": "Experiment 2: Write a program on strings and dictionaries"}])
    assert LINES[anchors[0]][3].startswith("Experiment 3")
