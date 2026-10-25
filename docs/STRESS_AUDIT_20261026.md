# LabMate compact stress audit 26 October 2026

Five of six demanding exercise manuals passed after the compatibility fixes. Each manual contains one exercise; this is a compact stress suite, not an exhaustive university syllabus certification.

| Manual | Outcome | Checks |
| --- | --- | --- |
| Python Dijkstra | PASS | Five graphs including unreachable vertices, zero and parallel edges, large distances |
| Java topological sorting | PASS | Five graphs including cycles, isolated vertices, parallel edges and a self loop |
| C++ Kruskal | PASS | Five graphs including disconnected and one-vertex graphs, negative weights, loops and 64-bit cost |
| DSA in C AVL trees | PASS | Seven insertion sequences covering four rotations, duplicates, ascending keys and an empty tree |
| HTML task board | FAIL | Blank-input validation passed; the edit input did not become visible under the expected selector. Persistence and layout scenarios were not reached. |
| React book library | PASS | Real navigation, dynamic/invalid routes, search exclusion, favourites before/after reload, removal and mobile layout |

The 22 console input cases include nine unseen cases that were not provided to the model. Expected answers were calculated independently. Every source image hash was checked against executed source. All six Word packages and their embedded images were validated and opened/rendered in native Microsoft Word. No rendered PDF text lay outside page bounds. There are 40 rendered pages in total.

## Issues found and fixed

- Actionable requirements entirely inside an inline Aim paragraph were rejected. The parser now preserves these statements.
- C11 was misidentified as Python. C standard labels are recognized.
- Python generation selected a blocked sys import. The generator now uses supported input handling; runtime restrictions remain unchanged.
- Persistence coverage wrongly demanded typing, rejecting click-based favourites. It now requires a real input action plus the same changed scoped state before and after reload. Negative regression tests reject unchanged or unrelated observations.

## Remaining issues

The hard HTML edit flow did not pass within the three-attempt repair limit. Its Word file is a diagnostic, not a verified solution. Do not describe its unexecuted persistence/mobile scenarios as passed.

Report pagination still needs cleanup: a sample expected-output line can spill onto a mostly empty page, and the HTML diagnostic contains a caption-only continuation page. The React report also contains repeated development-server WebSocket warnings even though its browser checks passed. These are retained here as genuine export findings; the reports are not claimed to be publication-ready layouts.

## Cost and evidence

Eleven live generation calls were used across the entire test, including failed drafts. Six cached responses/replays avoided more model calls. Parsing, oracle calculations, the unseen-input executions, image/package checks and native Word rendering used no AI calls. The final regression run passed 23 checks.

The manuals folder contains the exact reproducible input requirements. Results contains five passing Word reports and one clearly failed HTML diagnostic. Internal PNGs, PDFs, caches, credentials and databases are excluded from this archive.
