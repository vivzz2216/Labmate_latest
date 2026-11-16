# Lab testing: errors not resolved (2026-11-16)

Date of the testing programme: **16 November 2026** (local run: Java, Python, SQL, DSA, ADSA, Deep Learning, Distributed Computing, Computer Networks).
Everything fixed is described in the commit and in the per-lab reports. This list is only what was **not** resolved in that session. Per instruction, the Distributed Computing items were listed, not fixed.

## Distributed Computing (not fixed on request)
| # | Error | Detail |
|---|---|---|
| D1 | Exp 2 (Java RMI calculator) printed no client lines in the final run | cause not isolated: port 1099 still held by an earlier test server, or the generated server; needs a rerun on a clean machine |
| D2 | Exp 6 (Lamport clocks) fails the output check in the final run | model wrote "P2 receives the message and sets..." instead of "...receives the message from P1 and sets..." |
| D3 | Exp 4, 7, 2, 6 each fail in some runs | run-to-run variability of the AI output (wrong order of lines, mappers printed in completion order, token ring output lost); the automatic correction step does not always fix it |
| D4 | Server and client written as one driver class in a single JVM cannot be independently verified | by design of the check; the model chooses this layout in some runs (Exp 1 earlier, Exp 3 in one run) |
| D5 | Final result of the best of five runs: 6 of 8 completed | runs gave 0, 3, 4, 5, 6 of 8 |

## SQL
| # | Error | Detail |
|---|---|---|
| S1 | Workbench Exp 1 (constraints): extra `error_log` table makes `SHOW TABLES` differ from the manual | model's way of showing errors; correctly flagged |
| S2 | Workbench Exp 2: a statement that errors on purpose (foreign-key violation) ends the run as failed | the pipeline has no "expected error" concept; needs a feature |
| S3 | DB Browser replica shows whole-number REAL values without `.0` (38000 instead of 38000.0) | display only; values are correct |
| S4 | MySQL CLI replica, signed out: falls back to the old interpreter, which is inaccurate (about 60 of 87 statements) | by design, with a notice; real engine only when signed in |
| S5 | CLI `SHOW DATABASES` lists only the student's databases | sandbox restriction |
| S6 | `test_mysql_timeout_enforcement` failed twice while heavy jobs ran in parallel | passes alone; timing-sensitive test |
| S7 | The Workbench code-page paging fix was not regenerated into the delivered SQL report | the delivered report predates the fix |

## Java
| # | Error | Detail |
|---|---|---|
| J1 | Eclipse and IntelliJ replicas, signed out: old offline interpreter is inaccurate (0 of 16 for IntelliJ) | by design, with a notice |
| J2 | Output verification uses the manual's sample input only | a program that hard-codes the sample passes |
| J3 | Code::Blocks / Workbench theme variants untested for Java | out of scope |

## Python
| # | Error | Detail |
|---|---|---|
| P1 | Verification uses only the manual's sample | one IDLE program replayed a built-in demo and still passed |
| P2 | IDLE "RESTART" banner wraps on long file names | cosmetic |
| P3 | Tkinter on Linux/Railway (Xvfb path) is written but was never run | untested |

## DSA / ADSA (C)
| # | Error | Detail |
|---|---|---|
| C1 | Delivered DSA/ADSA reports predate the VS Code terminal-command and file-name fixes | still show `File (name.c)` and `exp1_avl_tree_aim.c` |
| C2 | 3 test cases differ between generated programs and my reference | unspecified edge cases (unknown hash/trie operation arguments; reference DFS output for disconnected graphs) |
| C3 | Reports carry the test account name that changed between runs | harness artifact ("ADSA Tester" in DSA headers) |

## Deep Learning
| # | Error | Detail |
|---|---|---|
| L1 | Colab light, Exp 3: SGD and Adam weights 2.77 / 2.79, outside 3 +/- 0.2 | slower convergence in that generation |
| L2 | App's own output check is "not specified" for this manual | training numbers are not exact; I validated metrics myself |
| L3 | Dark report predates the Keras progress-bar collapse fix | only the light report has it |
| L4 | Not tested: GPU, pretrained weights (no network), Jupyter theme for Deep Learning | |

## Computer Networks
| # | Error | Detail |
|---|---|---|
| N1 | Production needs `STUDIO_URL` (and related settings) for the studios | not configured anywhere; local only |

## Whole project / environment
| # | Error | Detail |
|---|---|---|
| E1 | The full backend test suite result was never obtained | the background run produced an empty output file; related suites were run and pass, earlier full-suite failures were environment-only (missing torch/keras) |
| E2 | The AI provider (GLM) repeatedly paused runs (cooldown / response deadline) | not an app defect; runs had to be resumed |
| E3 | `npm install sql.js` pruned `@dnd-kit`, `react-dropzone`, `@tabler` and some radix packages from `frontend/node_modules` | nothing imports them (`package.json` already omitted them) |
| E4 | Hooks fail when the shell directory is `frontend/` | `memory_graph.py` path is relative to the repo root; environment issue |
| E5 | Stray test output files in `backend/screenshots/` and untracked folders `--quiet/`, `backend/pytest-of-pilla/` | not committed; should be cleaned or ignored |
| E6 | No hidden test cases in any lab | every result is checked against the manual's sample plus my own test cases only |
