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

---

# QA pass 2026-11-17: Ubuntu/UNIX, Networking, Android Studio, Deep Learning (R)

Same file, second pass (17 November 2026). Test artifacts: `C:\Users\pilla\Downloads\labmate_lab_testing\{networks,r}\` (reports, logs, manuals). Status words: **PASSED** (ran end to end and the evidence was inspected), **FAILED**, **PARTIAL** (only part of the workflow could be exercised), **BLOCKED** (could not run here). Every PASSED line was run in this session; nothing is assumed.

## Result summary
| Lab | Experiment(s) tested | Status | Notes |
|---|---|---|---|
| Ubuntu / UNIX | none run end to end | **BLOCKED** | worker VM health check fails (U1). Only the logic-level unit suites ran: `test_ubuntu_pipeline`, `test_unix_command_lab`, `test_unix_manual_repair` passed (inside 223 passed together with the R and network suites). No real Ubuntu manual, command, terminal run or screenshot was verified. |
| Networking: Wireshark | Exp 5 (real manual `Exp 5 Lab Manual.docx`) | **PASSED** | 12 screenshots, both post-experiment tables filled from decoded bytes; labelled as the LabMate practice environment (not real Wireshark). The built-in practice capture was used; no `.pcap` was uploaded. |
| Networking: Packet Tracer | Exp 7 (4 scenarios) and Exp 9 (RIP, 3 routers), real manuals | **PASSED** | 14 and 9 screenshots; observations match the simulated events (flooding, ARP cache, RIP convergence, re-route after link failure). Topologies are the app's assumption where the manual figure is an image (disclosed in the report). Not real Packet Tracer; no IOS CLI. About 3 of 23 screenshots were opened and read; the rest were checked through captions and text only. |
| Android Studio | UI at `/android-studio`, engine functions run directly | **PARTIAL** | Front-end simulation (A1). No Gradle/Kotlin build, no emulator, no report pipeline. |
| Deep Learning (R) | EXP1 nnet on iris (custom manual), 8 built-in R experiments, keras experiment | **PARTIAL** | nnet and the 8 reference experiments PASSED; the keras/MNIST experiment cannot be done as written (R1, R2). |

## Bugs found and fixed in this pass (each retested)
| # | Bug | Root cause | Fix | Retest |
|---|---|---|---|---|
| F1 | **Every workflow that reaches `verification_summary` crashed** with `NameError: name 'semantic' is not defined` (`evidence_planner.py`) | stray line `if semantic: checks['output']='failed'` from commit 6a517b8 on main (the semantic check already runs in `assignment_workflow.py`); present on `main` and on this branch | removed the dead line | `test_r_runtime.py` full-workflow test (failed before) now passes; R end-to-end runs through the API complete |
| F2 | **SQL Workbench capture was broken everywhere**: `name 'capture_sql_frame' is not defined` | merge 2fb5d13 kept the three calls from main but dropped the function definition | restored `capture_sql_frame` in `lab_capture.py` (main's version) | `test_sql_practical_evidence`, `test_sql_update_evidence`, `test_sql_screenshot` pass |
| F3 | `_capture_workbench` reported the height of the first frame while writing the last frame to the output file | frames are now fitted individually | measure the file that is written | `test_sql_screenshot` passes |
| F4 | `test_source_evidence::test_distributed_output_frame...` timed out | test looked for `.terminal-output` and `.terminal-tabs`, which the VS Code integrated-terminal template on this branch no longer has | test now reads `.term-body` and `.term-tab.active` | passes |
| F5 | Failed R reports said "Browser evidence unavailable: the browser could not capture this run" although the RStudio screenshots were captured | the check looks for the word "browser" in captions; RStudio captions never contain it | skip that sentence for language `r` | two failing R runs afterwards: sentence absent |
| F6 | Android Studio: a `{` inside a `/* ... */` comment made the build fail with "missing closing brace" | brace counter stripped only `//` comments | block comments (also multi-line) are skipped | node harness: single-line, multi-line and "real brace removed" cases behave correctly; `tsc --noEmit` clean |

Test result after the fixes: R, network, UNIX, SQL evidence and source-evidence suites 53 + 223 passed. Not run: the full backend suite.

## Open issues: major (not fixed; cause and recommendation)
| # | Lab | Issue | Cause | Recommended solution |
|---|---|---|---|---|
| R1 | Deep Learning (R) | A manual asking for `library(keras)` (also torch, tensorflow, neuralnet) cannot be satisfied: the packages are not installed and are not on the allow-list (`security/r_code.py`, `r_instructions()`). The model then **silently substitutes** another method. Run 1: `nnet` on synthetic "digits"; the script crashed (`object 'X1' not found`) and the report was correctly marked failed. Run 2: a hand-written base-R network on the **iris** data (66.7% accuracy), titled and file-named "keras", marked **completed**, with no note in the report | no R deep-learning stack installed; output check is "not_specified", so any script that runs passes | Install R `keras`/`torch` (plus the Python backend) in the Docker image and allow-list them, or fail or flag the part when the requested package is unavailable and add a visible Note, as the network labs do |
| R2 | Deep Learning (R) | Same silent-substitution problem for data: the manual said `students_2026.csv` must not be created or simulated; in 1 of 3 runs the repair step created the file with invented data and the report shows a pass (the other 2 runs failed correctly) | the repair pass may write files; verification does not know the file is not supplied | reject repairs that write the input file the task forbids; disclose generated sample data in the report |
| U1 | Ubuntu / UNIX | Real Ubuntu execution could not be tested. `local_worker.py start` boots the VM (SSH on 2226 answers, redis-server active, the SSH tunnel to redis works when started by hand) but `worker_health` stays "unavailable"; `labmate-network.service` (QEMU static network fallback) is failed in the guest, and no worker service was found running. I stopped the VM again afterwards | not isolated; probably the guest image (worker not started after this boot) rather than app code | boot with the serial console, find why the worker does not register on redis and why `labmate-network` fails, then rerun `backend/scripts/run_unix_manuals_e2e.py` on a real UNIX manual. Docker Desktop is not running and WSL is not installed on this PC, so there is no other route here |
| A1 | Android Studio | The lab is a UI clone. "Build" means brace balance and XML tag matching only, so a program with an undefined function, a type error or a missing import still shows BUILD OK and runs (all three confirmed with the engine); logcat and build times and timestamps are hard-coded (2026-11-15 22:4x); emulator output is simulated. No Android manual can go through upload and report generation (no backend code handles Android) | by design of the clone | Decide the product scope. For real output: Gradle + Android SDK + an emulator or Robolectric in the worker image. Short term: label the screen as a simulation, including in reports |

## Open issues: minor
| # | Lab | Issue |
|---|---|---|
| M1 | Android Studio | At a 1024 px wide window the Split-view preview overlaps the code editor and the page scrolls sideways; fine at 1600 px |
| M2 | Android Studio | After clicking Run app and the Build/Run tabs, the bottom panel still showed Logcat in the screenshots I took; I did not confirm whether this is a bug |
| M3 | Android Studio | Not tested: Design/XML layout view, Gradle sync, terminal commands, device switching, editing `activity_main.xml` |
| M4 | R | The heading of a failed R part still says "has not passed browser verification" |
| M5 | Networking | Not done: `.pcap` upload path, the other experiments of the networks manual set, a visual read of every report screenshot |
| M6 | Whole project | `test_colab_evidence_theme` (2 tests) fails here with "Notebook worker exited": this test environment has no numpy/torch for the notebook worker; environmental, unrelated to these fixes |
| M7 | Whole project | The dev server on port 3000 answered `/` with HTTP 500 on the first request (other pages 200); not investigated |
| M8 | Environment | Another session modified `config.py`, `database.py`, `notebook_runtime.py`, `student_identity.py`, `AdmissionGate.tsx` and overwrote one of my edits in `assignment_workflow.py` while this pass ran; I re-applied it. Check `git diff` before committing |

---

# Merge repair 2026-11-17 (critical)

**What was wrong.** The merge that is now `main` (2fb5d13, "Merge remote-tracking branch 'origin/main' into lab-testing-and-real-engines") resolved the 113 files that both sides had changed by keeping the branch side: 88 files entirely, 25 mixed, none by main. That silently dropped main's 15–16 November releases. The agreed rule was "main wins, keep the branch's lab work". Lost pieces included the lab catalogue and labs page, MU IDE associations, billing UI, notebook corpora, the extra Deep Learning requirement verbs, `capture_sql_frame` (every SQL Workbench capture failed), and the `semantic` variable in `verification_summary` (every workflow crashed).

**What was done.** The merge was rebuilt as "main wins" on branch `fix/restore-main-wins-merge` (commit 9062ea9, whose parent is 2fb5d13, so it fast-forwards `main`). The branch's lab work was then put back wherever the main-wins resolution had dropped it:
- Computer Networks: the manual hook, studio parts, `attach_evidence` with studio images and explanations, the Word block with tables, explanations, observations and notes.
- UNIX: 9A/9B experiment labels, shell/sed/awk/perl routing, the UNIX practical filter, the Ubuntu retry draft and repair condition, the Ubuntu report layout.
- Deep Learning: the offline Keras stand-in datasets (they announce themselves), and `USERNAME` in the notebook kernel so torch imports on Windows.
- PDF OCR helper, manual limits, Tkinter captions, and a failed SQL statement keeping its own Workbench frame.

Branch billing and catalogue changes were not brought back (main's pricing and catalogue win, as chosen).

Because of this repair, three items in the fix pass below changed:
- **F1:** main's semantic output check is restored, not removed.
- **F2:** `capture_sql_frame` is main's own definition.
- **Mojibake:** never existed in main's version of the file.

## Fixed during the merge repair (retested)
| # | Problem | Fix |
|---|---|---|
| G1 | `import magic` (python-magic) crashed the whole Python process on Windows: it loads Git's `msys-magic-1.dll` (access violation), so every test importing the upload router died and the full suite never finished (the old item **E1**) | On Windows python-magic is skipped unless `LABMATE_USE_LIBMAGIC=1`; upload validation uses its header/signature fallback. Production (Linux) unchanged |
| G2 | Main's own tests contradicted main's code: tkinter reported unsupported, a `SyntaxError` expected from validation, "-style preview" in compact captions, `.terminal-output` in the VS Code template, raw DECIMAL rows in Workbench grids | Tests updated to the current, deliberate behaviour (Tkinter runs for real; Python reports syntax errors itself; captions name the file; integrated terminal; Workbench shows `25.50`) |
| G3 | Distributed rule (mine) failed every distributed run that had no expected output | Only networked programs (sockets, RMI, server/client) need the independent behaviour check, and they are capped at "execution tested" instead of failing |
| G4 | VS Code status bar said "File" for C programs | Language name taken from the file extension (C, C++, Java, …) |
| G5 | Stale DSA/ADSA VS Code reports | Regenerated with the real `gcc … .exe` terminal command and title-based file names (old copies kept as `*_before_20261117.docx`) |

---

# Fix pass 2026-11-17 (all open items, most critical first)

Every item listed above in this file now has one of four outcomes: **FIXED** (changed and retested), **FIXED, NOT FULLY RETESTED**, **NOT A CODE BUG** (environment, provider or test harness) or **BY DESIGN / NEEDS A PRODUCT DECISION**. Retest evidence is in the last column.

## Critical and major
| # | Item | Outcome | What changed | Retest |
|---|---|---|---|---|
| U1 | Ubuntu worker never became healthy (Ubuntu labs blocked) | **FIXED** | Root cause: on Windows, `ssh` resolved to Git's MSYS `ssh.exe`, which aborts with `0xC0000022` when started by Python, so both the health probe and the redis tunnel died at once. New `isolated_runtime.ssh_executable()` prefers the Windows OpenSSH client, used by `worker_command`, `ubuntu_runtime` and `scripts/local_worker.py` | `local_worker.py start` reports `ready: true`, redis tunnel owned. Real manuals end to end on the VM: **Expt 7 (shell scripts) completed, 13 native frames; Expt 9A (grep/egrep) completed, 9 frames**; gedit capture inspected |
| U1b | VM `labmate-network.service` failed every boot | **FIXED** (VM config) | it hard-coded `enp0s2`; the NIC is `enp0s1`. Now uses the first ethernet device and only adds an address/route when missing (backup `.bak-20261117` in the VM) | service `active`, default route unchanged |
| P3 | Tkinter on Linux had never run | **FIXED** | Found a real gap: neither the worker provisioning nor the Dockerfile installed Tk, so every Tkinter lab failed on Linux. Added `python3-tk` to `provision_sandbox.sh` and `libtk8.6` to both Dockerfiles; installed `python3-tk` in the local VM and synced the current `backend/app` into the VM runtime (old copy kept as `app.bak-20261117`) | Tkinter calculator through the isolated worker: **passed**, Xvfb, real click (`Result: 8`), 3 captures. The Docker image was not rebuilt here (Docker Desktop not running) |
| F1 | `NameError: semantic` crashed every workflow | **FIXED** | the merge had dropped the line that defines `semantic`; main's semantic output check is restored (see Merge repair) | `test_r_runtime` full workflow and the evidence tests pass |
| F2 | `capture_sql_frame` undefined, all Workbench captures broken | **FIXED** (earlier in this pass) | definition restored | SQL evidence tests pass |
| NEW | Mojibake (`â€”`, `â€“`) in the branch's `assignment_workflow.py`: report headings and captions printed `â€”`, and the experiment-title and experiment-number regexes no longer matched en/em dashes | **FIXED** | 15 sequences restored to `—`/`–` (introduced by my commit 8879347). No other file in backend/frontend/docs has mojibake | grep clean; affected suites pass |
| R1 | R manual asking for keras/torch/caret etc.: silent substitution reported as a pass | **FIXED** | `r_code.unavailable_requested_packages()`. The generation prompt now names the missing package and asks for a `NOTE:` first line; the R verification adds `runtime_notes`, and the report prints **"Note: the manual asks for the R package keras, which is not installed in the LabMate R runtime, so the program uses a substitute and does not use keras."** | Same keras manual through the API: report contains the Note. Unit tests added |
| R2 | Invented input file reported as a pass | **FIXED** | `r_code.fabricated_input_files()` (a file the manual names as input that the script writes and then reads back). If the manual forbids invented data the part fails with a clear error; otherwise the report gets a Note. The prompt tells the model which files are not supplied | students_2026.csv manual: fails correctly with "file not found", no fabrication. Unit tests cover output files, write-then-read labs and forbidden fabrication |
| A1 | Android "build" accepted undefined names and missing imports; fixed fake timestamps | **FIXED (partly by design)** | New "Unresolved reference: X" check (capitalised calls must be declared, imported or implicit in Kotlin; files with wildcard imports skipped). Logcat and build times use the real clock (the server render keeps fixed times to avoid a hydration mismatch, then replaces them on mount). **Still a simulation:** type errors are not detected, and there is no Gradle, emulator or report pipeline. Making it real needs the Android SDK and Gradle in the worker (product decision) | Engine harness: misspelled call and removed import now FAIL, both bundled presets build with no false positives; UI on a healthy dev server shows 2026-11-17 times |
| S2 | Deliberate SQL error (constraint demo) ended the run as failed | **FIXED** | A statement whose comment says `-- EXPECTED ERROR` / "should fail" etc. is kept with its real MySQL error, marked `expected_error`, and the script continues. The check text says how many deliberate errors MySQL rejected. The prompt tells the model to mark such statements and never to add helper tables like `error_log` (also covers **S1**) | `test_sql_expected_error.py` against real MySQL: duplicate key recorded, script continues, unexpected errors still stop the run |
| D1 | RMI/socket client printed nothing when the port was held by an earlier server | **FIXED** | `dc_runtime._busy_ports()` checks the fixed ports in the source (createRegistry, ServerSocket, `PORT = n`) before starting, and reports "Port N is already in use…" instead of an empty run | unit test with a held port |
| D2/D3 | Distributed output drifted (missing words, wrong order) and repair did not always fix it | **IMPROVED** (model variability remains) | The repair prompt now lists the exact expected lines that are missing or reworded, says when the order differs, and for distributed programs asks for deterministic ordering after joining threads | unit test of the gap text. Not re-run end to end on all 8 DC experiments, since results vary run to run with the model |
| J2/P1/E6 | Verification only used the manual's sample, so a hard-coded program passed | **FIXED, NOT FULLY RETESTED** | Console programs (Python/Java/C/C++) that read numeric input are run a second time with every number changed by one. If the output is identical, the report gets a Note that the program may print a fixed copy of the sample | unit tests pass; a full API run was not done because the API was busy regenerating reports |
| S6 | `test_mysql_timeout_enforcement` flaky under load | **FIXED** | Race: a late watchdog `KILL QUERY` could kill the next statement on the connection. The kill now checks under a lock whether the statement already finished | new stress test: 16 concurrent timeouts, every follow-up query succeeds |

## Minor
| # | Item | Outcome |
|---|---|---|
| S3 | DB Browser showed 38000 for a REAL value | **FIXED**: query results read SQLite's storage class (`useBigInt`: INTEGER→bigint, REAL→number) and Browse Data uses the column's REAL affinity; whole REALs print as `38000.0`. Engine harness verified, `tsc` clean |
| M1 | Android: page scrolled sideways at 1024 px; preview overlapped the code | **FIXED**: root pinned with `position: fixed; inset: 0`; preview canvas uses `align-items: safe center`. Measured: page width equals window width, card inside its pane |
| M2 | Android bottom tabs did not switch | **NOT A CODE BUG**: the port-3000 dev server has a corrupted `.next` (a `next build` wrote into it while `next dev` ran): `main-app.js` and `layout.css` return 404, so React never hydrates. On a healthy dev server (port 3100) Build/Run/Terminal/Logcat all switch. **Restart the dev server (`npm run dev`) after deleting `frontend/.next`.** Same cause as **M7** (HTTP 500 on `/`) |
| M4 | Failed R part said "has not passed browser verification" | **FIXED**: wording follows the evidence kind (R/RStudio, notebook, Java UI, HTTP, Ubuntu, browser) |
| P2 | IDLE RESTART banner wrapped on long file names | **FIXED**: the `=` bars shrink to fit, as in IDLE; only an over-long path wraps. Rendered and checked; test added |
| E4 | Hooks failed when the shell was in `frontend/` or `backend/` | **FIXED**: `.claude/settings.json` calls `$CLAUDE_PROJECT_DIR/.claude/tools/memory_graph.py` |
| E5 | Stray untracked folders | **FIXED**: `backend/pytest-of-*/` and `backend/labmate-browser-tmp/` added to `.gitignore` (`--quiet/` no longer exists) |
| N1 | Studios need `STUDIO_URL` in production | **NOT A CODE BUG**: `STUDIO_URL` already falls back to `POWERBI_STUDIO_URL`, then `FRONTEND_URL`; production only needs `FRONTEND_URL` set (and Chromium, which the Dockerfile installs) |
| C1, S7 | Delivered DSA/ADSA/SQL reports predated fixes | **FIXED** for DSA and ADSA (VS Code): regenerated 7/7 each, old copies kept as `*_before_20261117.docx`. The SQL Workbench report was not regenerated |
| L3 | Dark Deep Learning report predates the progress-bar fix | **NOT REGENERATED**: needs the torch/TensorFlow API environment and about 30 minutes of model time; the fix itself is in code and tested |
| C3 | Test account name changed between harness runs | **NOT A CODE BUG**: the harnesses share one test account and each sets its own profile name |

## By design, environment or needs a product decision
| # | Item | Why it stays |
|---|---|---|
| J1, S4 | Signed-out Eclipse/IntelliJ/MySQL CLI replicas use the offline interpreter | real JDK/MySQL need a signed-in, rate-limited account; a notice is shown. Option: disable Run when signed out |
| S5 | `SHOW DATABASES` lists only the student's databases | sandbox isolation |
| D4 | One-JVM server+client cannot be independently verified | by design of the check |
| C2 | 3 edge cases differ from my reference | the manual does not specify them |
| L1, L2 | DL metrics vary per run; output check "not specified" | training is stochastic; metrics are checked by tolerance, not exact text |
| E2 | GLM cooldowns and deadlines | provider limits |
| E3 | `npm install sql.js` pruned unused packages | none are in `package.json` |
| J3, L4, M3, M5 | Untested scope (Code::Blocks/Workbench themes for Java, GPU, Jupyter DL theme, Android Design view, `.pcap` upload) | not run in this pass |

## Railway deploy fix 2026-11-17
| # | Problem | Fix |
|---|---|---|
| H1 | Railway backend for merge 2fb5d13 failed its health check: `ModuleNotFoundError: No module named 'psycopg'`. The merge had raised SQLAlchemy to 2.1.3, which uses psycopg v3 for a bare `postgresql://` URL, but the image installs psycopg2. It also pulled in untested upgrades (redis 8, bcrypt 5, anthropic 1.x, uvicorn 0.54) and dropped packages main still lists | `backend/requirements.txt` is back to the set the full backend suite ran with (main's pins plus openai 3.24, which the code's `OpenAI` client needs, and fakeredis). `database.py` names the `postgresql+psycopg2` driver for `postgresql://` and `postgresql+psycopg://` URLs. Retested: startup/auth/hardening tests 58 passed |
| H2 | Railway frontend build of 2fb5d13 failed | Lint errors in the waiting-room page (fixed in bafeedc). `next build` passes locally; confirmed by the Railway deploy of this commit |
