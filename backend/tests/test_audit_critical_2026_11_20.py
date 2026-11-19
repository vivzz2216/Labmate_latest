"""The three Critical findings of the 2026-11-20 live audit of 14 engineering lab manuals.

1. C programs were labelled python (a C experiment never ran) and a Java/JDBC program sql (a wrong answer marked completed).
2. Any manual mentioning Packet Tracer and routers became one built-in exercise, dropping every other experiment.
3. The production image lacked scripts/ubuntu_curriculum.py, so every Ubuntu manual crashed.
"""
from pathlib import Path

import pytest

from app.services.manual_sections import declared_code_language, numbered_experiments, section_language
from app.services.network_labs import detect_network_lab, experiment_heading_count, network_parts_for

C_EXPERIMENT = """Experiment 1: Quadratic Equation Roots and Integer Palindrome
2. Aim: To compute the roots of a quadratic equation and test whether an integer is a palindrome.
7. Program/Code:
C
#include <stdio.h>
#include <math.h>
int main(void) { double a, b, c; scanf("%lf %lf %lf", &a, &b, &c); return 0; }
8. Sample Input and Output:
Enter a, b, c: 1 2 5"""

DSA_EXPERIMENT = """Experiment 1: Linked-List Stack ADT and Infix-to-Postfix Conversion
7. Program/Code:
#include <stdio.h>
#include <stdlib.h>
struct Node { char data; struct Node *next; };"""

CPP_EXPERIMENT = """Experiment 2: Generic Sorting with Function Templates
7. Program/Code:
#include <iostream>
template <typename T> void sortArr(T a[], int n) {}
int main() { std::cout << "sorted"; }"""

JAVA_JDBC_EXPERIMENT = """Experiment 3: Inheritance, Custom Exception Handling, Multithreading and JDBC
2. Aim: Connect to a MySQL database with JDBC and print the rows.
7. Program/Code:
Java
import java.sql.*;
public class TeacherApp { public static void main(String[] args) { System.out.println("DB Row -> 101"); } }"""

UNLABELLED_JAVA = "Experiment 4: Bank account\nclass Bank { public static void main(String[] a) { System.out.println(1); } } uses MySQL tables"


def split(text):
    lines = text.splitlines()
    return lines[0], "\n".join(lines[1:])


@pytest.mark.parametrize("text,expected", [
    (C_EXPERIMENT, "c"), (DSA_EXPERIMENT, "c"), (CPP_EXPERIMENT, "cpp"), (JAVA_JDBC_EXPERIMENT, "java"), (UNLABELLED_JAVA, "java"),
])
def test_c_cpp_and_java_programs_get_their_own_language(text, expected):
    assert section_language(*split(text)) == expected


@pytest.mark.parametrize("text,expected", [
    ("Experiment 1: Fibonacci\n7. Program/Code:\nPython\nprint(1)", "python"),
    ("Experiment 1: DDL commands\nCREATE TABLE BUS (bus_no INT);\nSELECT * FROM BUS;", "sql"),
    ("Experiment 2: CNN on MNIST\nimport tensorflow as tf", "colab"),
    ("Experiment 1: Linux commands\n7. Program/Code:\nBash\nls -l", "python"),  # Bash is decided by the title rules, not here
])
def test_other_languages_are_unchanged(text, expected):
    title, body = split(text)
    if "Linux" in title:
        assert declared_code_language(body) is None
        return
    assert section_language(title, body) == expected


def test_declared_label_only_counts_directly_under_the_code_heading():
    assert declared_code_language("7. Program/Code:\nC\n#include <stdio.h>") == "c"
    assert declared_code_language("Program:\n  C++  \nint main") == "cpp"
    assert declared_code_language("Grade\nC\nRemarks") is None  # a stray 'C' elsewhere is not a label


def test_numbered_c_manual_is_labelled_c():
    manual = "C Programming Lab Manual\n" + C_EXPERIMENT + "\n" + DSA_EXPERIMENT.replace("Experiment 1", "Experiment 2")
    assert [s["language"] for s in numbered_experiments(manual)] == ["c", "c"]


NETWORKS_MANUAL = """Experiment 1: Network Diagnostic Commands and Wireshark Packet Analysis
Run ping and traceroute, capture in Wireshark and study the packets.
Experiment 2: Cisco Packet Tracer Multi-Subnet Routing Simulation
Use Packet Tracer: one router connects two subnets. Configure the router, router interfaces and test with ping. The router forwards.
Experiment 3: UDP Socket Simulation of DNS Resolution
Write a Python program using UDP sockets."""

MIXED_WITH_RIP = """Experiment 1: Write a Python program to add two numbers.
Experiment 2: Dynamic routing
Start packet tracer, place three routers (Router 0, Router 1, Router 2) and enable RIP on every router.
Experiment 3: Write a C program to reverse a string."""


def test_a_multi_experiment_manual_is_never_replaced_as_a_whole():
    assert experiment_heading_count(NETWORKS_MANUAL) == 3
    assert experiment_heading_count("EXPERIMENT NO: 9\nTo design a network using three routers") == 1
    # the whole-document check is only used for a single-experiment manual
    questions = [{"id": i, "text": t, "language": "python"} for i, t in enumerate(
        ["Experiment 1: Network Diagnostic Commands ... Wireshark",
         "Experiment 2: Cisco Packet Tracer Multi-Subnet Routing. One router, router interfaces, router table.",
         "Experiment 3: UDP Socket Simulation"], 1)]
    kept, replaced = network_parts_for(questions)
    assert replaced == 0 and kept == questions


def test_only_the_rip_experiment_becomes_the_practice_exercise():
    questions = [{"id": n, "text": t, "language": lang} for n, (t, lang) in enumerate([
        ("Experiment 1: Write a Python program to add two numbers.", "python"),
        ("Experiment 2: Dynamic routing. Start packet tracer, place three routers (Router 0, Router 1, Router 2) and enable RIP "
         "on every router.", "theory"),
        ("Experiment 3: Write a C program to reverse a string.", "c")], 1)]
    out, replaced = network_parts_for(questions)
    assert replaced == 1
    assert [q["id"] for q in out] == [1, 2, 3]
    assert out[0]["text"].startswith("Experiment 1") and out[2]["text"].startswith("Experiment 3")
    assert out[1]["studio"] == "packettracer" and out[1]["studio_args"] == {"experiment": "exp9"}


def test_strict_check_needs_rip_but_the_whole_manual_check_is_unchanged():
    single_router_text = "Use packet tracer. Router 0 connects two subnets; configure the router and the router table."
    assert detect_network_lab(single_router_text) is not None          # old whole-document behaviour kept
    assert detect_network_lab(single_router_text, strict=True) is None  # per-experiment: not the RIP exercise


def test_existing_manual_numbers_are_kept_when_nothing_is_replaced():
    questions = [{"id": 1, "text": "Experiment 1: add", "language": "python"},
                 {"id": 3, "text": "Experiment 3: sort", "language": "python"}]
    assert network_parts_for(questions) == (questions, 0)


@pytest.mark.parametrize("dockerfile", ["Dockerfile", "backend/Dockerfile"])
def test_the_image_ships_the_ubuntu_curriculum_next_to_the_sandbox_files(dockerfile):
    # Railway builds the API from the repository root (railway.json -> Dockerfile); backend/Dockerfile is kept in step.
    text = (Path(__file__).resolve().parents[2] / dockerfile).read_text(encoding="utf-8")
    line = next(l for l in text.splitlines() if l.startswith("COPY") and "./scripts/" in l)
    for name in ("ubuntu_curriculum.py", "sandbox_job.py", "sandbox_broker.py"):
        assert f"backend/scripts/{name}" in line
    # the modules the Ubuntu labs import must exist where the image copies them from
    assert (Path(__file__).resolve().parents[1] / "scripts" / "ubuntu_curriculum.py").is_file()
