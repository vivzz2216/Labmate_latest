# Template architecture

## Separation of responsibilities

The existing FastAPI/workflow/runtime/report architecture remains. The evidence planner determines requirements; adapters execute and observe; the selector validates and chooses images; shared presentation templates render source or actual transcripts; the Word composer embeds the selected evidence and verification scope.

Presentation never supplies execution truth. A source preview cannot satisfy an execution requirement, a zero process exit cannot verify a GUI, and a browser render cannot satisfy a required click. Failure details belong in a diagnostic document whose workflow status remains failed.

## Category configuration

`TEMPLATE_CATEGORIES` in `backend/app/services/evidence_planner.py` is the shared registry. All categories have an explicit source and result kind and an availability flag.

| Required category | Registry category | Current layout | Actual support |
| --- | --- | --- | --- |
| C/C++ console | console | Source + actual process transcript + compile/run status in report | Tested |
| Java console | console | Java source + actual process transcript + compile/run status | Tested |
| Python console | console | Python source + captured process/input transcript | Tested within import/file policy |
| Java AWT | java_awt | Source + missing real-window evidence diagnostic | Blocked; no display/GUI capture adapter |
| Java Swing | java_swing | Source + missing real-window evidence diagnostic | Blocked; compilation alone is insufficient |
| JavaFX | javafx | Source + missing runtime/window evidence diagnostic | Blocked; JavaFX modules also absent |
| Python Tkinter | tkinter | Source + missing actual-window diagnostic | Blocked; policy/display/automation adapter absent |
| Python Flask | flask | Source + missing server/browser evidence diagnostic | Blocked; allowlisted import and server adapter absent |
| HTML/CSS/JavaScript | browser | Relevant source + original browser capture(s) | Static, interaction, local asset/fetch, multi-page and viewport fixtures tested |
| React | react | Source + original browser capture(s) | Multi-file Vite projects and state/navigation fixtures tested |
| Node HTTP page | browser | Source + actual browser page | Tested |
| Node backend/API | api | Source + actual structured HTTP transcript | Explicit local request/status/JSON fixtures tested; default upload generation remains partial |

Unsupported categories are explicit registry entries and diagnostic layouts, **not implemented GUI runtimes**.

## Shared components and controls

`backend/templates/evidence_theme.html` is one frame-free Jinja presentation. `ScreenshotService._render_template(..., presentation="evidence")` selects the lexer and palette, escapes output, and labels the preview. Language configuration uses Pygments Python/Java/C/C++/HTML/JavaScript lexers rather than maintaining separate screenshot pipelines.

- `view_mode="editor"`: rendered source preview.
- `view_mode="output"`: actual process transcript or captured HTTP request/response presentation.
- `palette="light" | "dark"`: light default; workflow style_2 selects dark.
- `line_numbers=True | False`: optional source line numbers; default on.
- `language`: explicit syntax selection, including C versus C++.
- Shared 960px source/transcript width and 16px monospace text; height follows content within the existing safety bound.
- Browser dimensions are independent and come from the runner/scenario, without image rescaling.

These options are internal configuration. The UI retains existing style identifiers; it does not yet expose a fully configurable layout editor. Legacy style_3 is not a new independently verified visual layout. The new default presentation identifies rendered source/transcripts and does not pretend to capture an IDE or GUI that was never opened.

`build_word_report` uses the existing `docx_layout.py` image helper for page-width fitting and tall-image slicing. It adds execution-stage status, scope/checks, uncertainties, browser/API test steps, expected/observed results, browser console errors, and missing-evidence diagnostics. The original DOCX document content, tables, headers and images remain preserved by the existing composer.

## Extension contract

To add a real GUI capability:

1. Provision a separate restricted execution environment with full relevant desktop libraries and a virtual display. Do not give the web backend arbitrary host display/filesystem access.
2. Implement adapter preparation, compilation/startup readiness, bounded execution, real window discovery, allowlisted control interaction, behavior assertions, native-window capture and process cleanup.
3. Return actual images, stages, observations and precise failure reasons using `RuntimeResult`. A process staying alive is not readiness proof.
4. Add objective-to-requirement mappings and GUI evidence validation. Keep `available=False` until actual positive launch, interaction, result capture and negative tests pass.
5. Test the report and diagnostic paths, isolation, cancellation, display teardown and cross-run access. Only then enable the registry entry.

Swing/AWT need separate tests even when they share an X11 display. JavaFX needs matching JavaFX modules/native libraries and toolkit startup. Tkinter needs Tcl/Tk plus its own window/control automation; Playwright cannot automate native Tk controls. Flask should use a dedicated bounded Python-server adapter, dependency allowlisting, HTTP readiness and the existing restricted browser protocol, not a blind import-policy exception. Prioritize Flask over adding several more Python GUI frameworks if teaching demand warrants it.

React uses trusted pinned React/Vite/Express dependency scaffolding. User package/lock/Vite config files are ignored; arbitrary installation scripts and arbitrary dependencies are not supported. Multi-file source/assets can be copied through the bounded project_files adapter. The trusted Vite JSX automatic-runtime config fixes components that legitimately omit `import React`. Top-level pins and the runtime cache exist; committing a transitive runtime lockfile is remaining reproducibility work.

## Compatibility and limits

Explicit legacy theme templates are retained to avoid an unrelated removal of existing endpoints. The main assignment workflow opts into the new shared presentation; legacy `/api/run` and optional IDE mockups still require migration and clearer labels. The legacy C/C++ hardcoded success/time defect is fixed even on that path.

The generated-result schema remains extended JSON in the existing database model, with optional frontend types. No public endpoint or database migration is required. Runtime multi-file/API capability is broader than the current standard generated-answer schema: project_files and API scenarios are not yet generated automatically from every uploaded manual.

Physical Word page rendering was attempted but blocked because the required bundled LibreOffice executable is unavailable. Structural DOCX opening, embedded PNG validity and shape aspect ratios passed. Do not call print layout or Word pagination visually verified until a supported renderer is available and every generated page has been inspected.
