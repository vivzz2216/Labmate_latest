# LLM providers and fallback routing

LabMate generates code through one primary provider chosen with `LLM_PROVIDER`, with an optional
recovery route. `backend/.env.example` lists every provider setting and the current defaults.
Keep all API keys on the backend, outside Git and outside any `NEXT_PUBLIC_*` variable.

## Routing

1. The configured primary provider is tried first, with retries on transient network errors and
   HTTP 429/500/502/503/504 using exponential jittered backoff. `Retry-After` is respected.
2. If it fails, the free fallbacks run in `FREE_LLM_FALLBACK_ORDER` (OpenRouter, then OpenCode when
   enabled). A malformed response also advances to the next enabled provider.
3. Every response must pass the server's JSON schema validation. If a reachable model returns
   invalid output, the bounded repair loop keeps the diagnostic instead of accepting it.
4. If every route is unavailable, rate limited or cooling down, completed results stay saved and
   the workflow pauses for retry. A provider failure never counts as a verified result.

Unconfigured or disabled providers are skipped. Temporary failures use cooldowns. Bad credentials,
unavailable models and access denials cool down for five minutes. Each free provider is tried at
most once per generation call, and changing a provider's key or model resets its cooldown.

Every request has a total response deadline, not only a read timeout, so a provider that sends
headers and then stalls is cancelled and the next route is used. An upstream error returned inside
an HTTP 200 body is treated as a provider failure.

## Generation contract

The generation schema requires four named browser-step fields with allowed action and locator
enums, plus an explicit README text field included in the project files. Missing scripts, assets,
required interactions or visible results fail verification.

Retrying a failed run replaces failed result slots and keeps verified later results. Resuming a
paused run continues the pending experiments and keeps exhausted failures as diagnostics. Those
failures still make the final workflow failed.

## OpenRouter

Create a key at [OpenRouter keys](https://openrouter.ai/settings/keys) and set it on the backend:

```dotenv
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
OPENROUTER_REASONING_EFFORT=low
FREE_LLM_FALLBACK_ORDER=openrouter,opencode
```

`openrouter/free` routes among the available free models. An explicit model must end in `:free`.
Each request carries a zero price ceiling for prompt, completion and per-request pricing, and
requires JSON parameters, so there is no paid fallback. Availability and rate limits depend on the
provider and your account.

## OpenCode

```dotenv
OPENCODE_ENABLED=false
OPENCODE_MODEL=big-pickle
OPENCODE_API_KEY=
```

OpenCode is implemented but disabled. Its free tier returned HTTP 403 (`FreeTierError`) for
requests from outside OpenCode, and LabMate does not work around that. Enable it only if OpenCode
permits external application access. A denial advances to the next route without retries.

## Rate limits at scale

Provider requests-per-minute limits, not server capacity, usually cap throughput when many students
generate at once. Check your provider's tier against the expected concurrency before a lab session.

Sources: [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-router),
[OpenRouter price ceilings](https://openrouter.ai/docs/guides/routing/provider-selection#max-price),
[OpenCode inference authentication](https://opencode.ai/v2/docs/console/api/inference/).
