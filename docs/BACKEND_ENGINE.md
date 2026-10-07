# Backend execution and reporting

The active provider is explicitly selected by `LLM_PROVIDER=groq` or `LLM_PROVIDER=gemini`. Groq uses `GROQ_API_KEY` and `GROQ_MODEL=openai/gpt-oss-120b` in the private backend environment. Groq responses use strict JSON Schema and are validated before use. Neither provider's key reaches the browser or student runtime.

Both providers retry transient network errors and HTTP 429, 500, 502, 503, and 504 responses with exponential full jitter. `Retry-After` is respected. Configure the active provider's `GROQ_RETRY_*` or `GEMINI_RETRY_*` settings. Authentication and invalid-request errors are not retried. There is no silent fallback to a different provider.

The assignment workflow stores completed answers and screenshot paths after every question. An exhausted transient retry changes the workflow to `paused`. Retrying the same questions, language, and instructions resumes at the first unfinished question. A prolonged provider outage or exhausted quota does not erase completed results.

`runtime_engine.py` gives every execution a fresh working directory. Java is compiled with `javac` and runs with piped Scanner input. C and C++ use `gcc` and `g++`, with C++ detected from language, source headers, or filename. Python uses a restricted local fallback, or a container with networking disabled and resource limits when Docker is available. Child processes receive no model keys, database URL, or session secrets. Compile/run timeouts, output limits, and process-tree cleanup apply.

HTML is rendered directly in Playwright. React and Node run on allocated loopback ports, which are forced into the Node server and Vite configuration. Browser capture permits resources from that runtime's origin. Dependency installation uses fixed approved packages and disables install scripts. Temporary servers are terminated after capture.

Capture themes display actual source and runtime output: IDLE for Python, Notepad/Command Prompt for Java, Code::Blocks for C/C++, and separate browser captures for web tasks. Templates never insert example output when a program produces no output.

Theory, Objective, Viva, and Concept sections are filtered before extraction, then all returned tasks pass the same actionable-programming filter. The original uploaded document is retained in the final report even though excluded sections receive no generated solutions.

The composer appends inline images in centered paragraphs, fits them to the current section's margins, preserves source styles and headers, and writes a validated DOCX package atomically. Original files are never overwritten.

## Verification

Run from `backend/`:

```text
python -m unittest tests.test_generation_service tests.test_backend_engine tests.test_assignment_workflow tests.test_workflow_resume tests.test_composer_preservation tests.test_workflow_api -q
```

Runtime tests require Java/Javac, GCC/G++, Node/npm, and Playwright Chromium. Executable paths can be set with `JAVA_COMMAND`, `JAVAC_COMMAND`, `C_COMPILER`, `CPP_COMPILER`, and `NODE_COMMAND`. The local workspace includes portable Java and GCC toolchains. Docker images install Java, GCC, Node/npm, and Chromium during their build.
