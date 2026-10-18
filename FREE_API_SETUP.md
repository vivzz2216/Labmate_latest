# Free API fallback setup

OpenRouter support is implemented and activated in the local backend. A real structured API request passed schema validation and returned 5 for 2 plus 3. OpenCode support is implemented but disabled: the live external request returned HTTP 403 stating that the free tier can only be used within OpenCode. No client impersonation or paid model substitution is implemented.

## Automatic routing

For the existing Groq configuration, LabMate first uses its configured Groq and Gemini recovery route. If that route fails, it tries **OpenRouter**, then **enabled OpenCode**, in `FREE_LLM_FALLBACK_ORDER` order. With an enabled free backup, the final Groq model advances immediately on an outage instead of holding the worker through its full retry budget. A malformed response also advances to the next enabled free provider.

Every free-provider response must pass the server's JSON schema validation. Web projects still pass file, requirement, browser and report checks. If a reachable model returns invalid JSON, the bounded code/test repair workflow retains the diagnostic. If all available routes are unavailable, quota-limited or cooling down, completed results remain saved and processing pauses for retry. Provider failures do not count as verified results.

The current generation schema requires four named browser-step fields with allowed action and locator enums, plus an explicit README text field included in the project files. Legacy recorded step formats remain readable. Missing scripts, assets, required interactions or real visible results still fail verification. Required markers must not invalidate accessible labels; generation instructions prefer stable, unique test IDs.

Retrying a terminal failed run replaces failed result slots while preserving verified later results. Resuming a paused run instead continues pending experiments and retains already exhausted failures as diagnostics. Those failures still make the final workflow failed; continuing does not turn them into verified results. The resume and preservation changes have dedicated real workflow/report regression tests.

Requests also have a total response deadline, including receiving the full body. The HTTP read timer alone can be kept alive by periodic data without a finished answer; assignment 20 exposed this gap after OpenRouter returned headers but never finished. A never-ending keepalive fixture now confirms cancellation and fallback. An upstream error inside HTTP 200 is treated as provider failure, not valid generated code. The focused deadline/provider/resume regression run passed 27 checks (`backend/audit_artifacts/openrouter-deadline-tests.log`).

Unconfigured or disabled providers are skipped. Temporary failures use cooldowns; bad credentials, unavailable models and access denials use a five-minute cooldown. Each free provider is attempted at most once in a generation call. Updating a provider key or model resets that provider's cooldown identity.

## OpenRouter activation

Create an API key at [OpenRouter keys](https://openrouter.ai/settings/keys). Place it on the backend, outside Git and all `NEXT_PUBLIC` variables:

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openrouter/free
OPENROUTER_REASONING_EFFORT=low
FREE_LLM_FALLBACK_ORDER=openrouter,opencode
```

For the current local app, the supplied key has been saved in `C:/Users/pilla/OneDrive/Desktop/labmate_latest/backend/.env` and the backend reloaded without rotating session secrets. The key is not included in these notes or Git. On Railway, add the same variables to the backend service and redeploy the changed source. No database migration is required.

`openrouter/free` routes among available free models. An explicit model must end in `:free`. Every OpenRouter request also carries a zero price ceiling for prompt tokens, completion tokens and per-request pricing, with required JSON parameters enabled. There is no paid fallback. Free-model availability and request limits still depend on the provider and account.

For the assignment 20 retry, the local backend is pinned to `nvidia/nemotron-3-super-120b-a12b:free`, with low reasoning effort and a 120-second total request deadline. The live model catalogue listed zero token prices, structured outputs and low reasoning support. This configuration gives the full-project request a bounded opportunity to finish; it does not establish a successful manual result. The generic defaults above remain available. The focused provider/deadline/resume checks passed 27 tests after this change.

## OpenCode status

```dotenv
OPENCODE_ENABLED=false
OPENCODE_MODEL=big-pickle
OPENCODE_API_KEY=
```

The public model list returned HTTP 200 and includes `big-pickle`. A small structured inference probe at `https://opencode.ai/inference/openai/v1/chat/completions` returned HTTP 403 `FreeTierError`. The response stated: “OpenCode's free tier can only be used from within OpenCode.” This observed restriction takes precedence over assuming access from the documentation's keyless free-model description.

Enable this adapter only when OpenCode permits external application access. An optional backend API key is supported; possession of a key has not been verified to lift the free-tier restriction. The adapter accepts only reviewed free chat model IDs, and a denial advances to the next route without retries or a workaround. OpenCode's time-limited free offers can change.

## Verification

The complete backend suite passed **346 tests** with 59 warnings in 367.91 seconds. After the final malformed-response and fast-failover guards, **31 focused provider, browser and workflow-resume checks** passed. Frontend source was unchanged. Local readiness and the existing account login returned HTTP 200; the backend was reloaded without rotating the session secret.

The new integration test routes a failed configured provider through an owned OpenRouter HTTP fixture, expands its generated Add plan, executes the unchanged project in real Chromium, enters 2 and 3, clicks Add and observes 5. This is a transport fixture test, not a live OpenRouter generation claim. Schema violations retain repair diagnostics, and exhausted provider access pauses even non-web jobs rather than selecting a local toy answer.

Live OpenRouter structured inference passed using the supplied key and the actual free router; see `backend/audit_artifacts/openrouter-live-probe.log`. The full ten-experiment manual has not been rerun through OpenRouter, so this probe does not establish manual acceptance. OpenCode external free access was tested and denied. See `backend/audit_artifacts/free-provider-browser.log`, `free-provider-workflow.log` and `free-provider-full-suite.log` for other validation details. Logs do not contain API keys or raw provider responses containing user source.

Sources checked 17 October 2026: [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router), [OpenRouter price ceilings](https://openrouter.ai/docs/guides/routing/provider-selection#max-price), [OpenCode inference authentication](https://opencode.ai/v2/docs/console/api/inference/), [OpenCode free model list](https://opencode.ai/v2/docs/console/models/#free-models).

## Assignment 20 recovery — 18 October 2026

Update: a subsequent **engineer-reviewed solution run** passed all ten experiments and completed assignment 20's normal execution and Word-export path. It passed 22 browser scenarios, 105 browser assertions and four API tests, with 59 captures in the separate test-result Word report. This does not supersede the live provider limitations below or claim successful API generation. See [the reviewed results](VERUANCE_REVIEWED_RESULTS_2026-10-18.md).

The full backend regression suite passed **351 tests** (59 warnings; 529.82 seconds) after the named browser-step and required README changes. Subsequent focused resume/API/queue checks passed **16 tests**. A live retry then exposed malformed provider file lists crashing repair-prompt construction; the parser now checks the types of previous file entries and entrypoints before including excerpts. The regression for malformed drafts and the provider/resume/API/queue suite passed **30 tests** (3 warnings; 43.64 seconds). This final parser fix was checked separately from the full suite.

Assignment 20 retained experiment 1’s verified result and experiment 2’s failed diagnostic, then resumed pending experiment 3 after the stopped worker was recovered. These test counts establish regression coverage, not acceptance of the ten live experiments. The recovered live run paused at experiment 3 (33%). OpenRouter reached its 120-second deadline; the reachable Groq backup returned a draft without browser_tests, then a Theme Toggle test with an invalid page locator for assert_attribute, followed by an invalid structured response. The repair parser stayed running through these drafts and the workflow paused when provider routes became unavailable/cooling down. Experiment 1 remains completed, experiment 2 remains failed, and experiments 3–10 are not completed. No full-manual acceptance or deployment readiness is claimed. The owned API status snapshot is saved locally in backend/audit_artifacts/assignment20-current.json.
