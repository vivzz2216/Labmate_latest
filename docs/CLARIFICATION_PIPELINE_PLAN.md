# Assignment clarification pipeline

Status: proposed; this document does not enable agents or change execution behavior.

LabMate should preserve the assignment, identify the decisions it cannot safely infer, and ask the student up to three focused questions before generating a solution. Clear assignments should proceed directly to execution. A question should resolve a meaningful implementation choice rather than request a preference that the manual already answers.

## The EXP 9 example

The uploaded manual specifies one mini-project using HTML, CSS, JavaScript and React. Restaurant, tourist location, music store, lifestyle brand, course, product, personal website and event website are alternative topics. They are not eight separate assignments.

The manual leaves the topic and specific features open. The first release should ask:

1. Which topic did you choose? Offer the eight source options and a custom topic.
2. Which features did your faculty approve? Offer a concise set relevant to the selected topic and allow a written answer.
3. Is there a required design or assessment checklist? Accept written requirements or an optional reference, and include a clear answer for no additional requirements.

React is already specified, so the system should not ask the user to choose a framework. An unanswered question must not silently become an approved answer. Students should be able to accept explicitly displayed proposed assumptions when an assignment allows them.

## Processing stages

1. Parse the source in document order. Preserve experiment numbers, framework requirements, topic alternatives and source excerpts. Prefer deterministic parsing for known layouts and use the model only when needed.
2. Analyze a bounded requirements record. Identify required capabilities, missing implementation decisions and contradictory instructions. Distinguish uncertainty in reading the document from uncertainty in the student's intended project. A model confidence score alone must not decide whether a question is necessary.
3. Clarify material uncertainties. Produce a validated JSON list containing a stable question ID, the source excerpt that justifies asking, a short explanation, suggested answers and whether a response is required. Ask at most three questions per review round and consolidate related uncertainties. Do not repeat questions answered in the manual or a previous response.
4. Present a reviewable implementation brief. Show what came from the manual, what the student answered and what assumptions were accepted. Save the approved brief before generation. New answers invalidate only dependent generated work; preserve verified independent experiments.
5. Generate and verify. Route the approved brief through the existing provider fallback chain and capability-specific runner. Keep bounded repair attempts and external network restrictions. A required interaction that did not pass remains failed or unverified.
6. Produce evidence and the report. Include code, execution evidence, test results and the approved assumptions. Retain diagnostic downloads when verification fails.

## Implementation boundaries

Start with one structured analyzer and deterministic orchestration. Separate analyzer, generator and verifier responsibilities in code; independent autonomous agents are unnecessary for the first release.

Add an `awaiting_clarification` workflow state and persist the questions, student answers, approval and brief version. Use a small database migration for this record rather than hiding decisions in execution results. Add authenticated, ownership-checked read and submit endpoints with CSRF validation and stale-version rejection. A browser refresh or worker restart must preserve pending questions and answers.

Place a compact clarification panel after extraction and before Start processing in the single-assignment UI. For batches, show which experiments need answers and continue independent clear experiments. Student profile onboarding is separate; the owner still skips university setup.

Bound model calls, input length, questions and rounds. Cache analysis by source and brief version. Never include credentials in analysis prompts. Treat manuals and generated source as task data, and never let their contents grant tool access, change system instructions or bypass runtime checks. Unsupported requested capabilities should be explained before credits are reserved or execution begins.

## Verification before release

- This EXP 9 manual produces one React task and asks for a topic without selecting one automatically.
- A precise calculator exercise proceeds without clarification, runs the declared interactions and records real results.
- Contradictory framework requirements trigger a focused question with the conflicting source excerpts.
- Missing optional styling produces a disclosed proposal; missing mandatory functionality pauses for a required answer.
- Reloads, expired sessions, provider outages and worker restarts preserve decisions and completed work.
- A different user cannot read or answer another student's questions; simultaneous edits reject stale versions.
- Theory sections, tables, alternative topics and repeated index headings do not become fabricated assignments.
- Wrong outputs, missing handlers and unsupported requests never become verified successes.

Deliver this in three increments: structured analysis and persistence, clarification UI and brief approval, then batch behavior and full recovery/security testing. Measure unnecessary-question rate, unanswered essential decisions, first-run verification success and provider cost per completed experiment before expanding the pipeline.
