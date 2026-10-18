# Payment verification — 18 October 2026

## Result

The implementation is complete locally, with passing automated payment/workflow tests and a passing frontend production build. **End-to-end successful hosted payment verification remains incomplete.** Do not describe this checkout as fully verified for live sales yet. Nothing in this payment change has been deployed to Railway, and no real-money payment was made.

Local frontend: `http://127.0.0.1:3016/#pricing`. Backend: `http://127.0.0.1:8016`. Test database: `backend/audit_artifacts/local-app/labmate.db`. The runtime starts without Docker. Payment credentials remain in the ignored backend environment; example files contain blank credential fields.

## Checks and evidence

| Check | Result |
| --- | --- |
| Full backend regression, including real Flask/Swing workflow reports and credit settlement | 407 passed, 65 warnings, 1026.10 seconds |
| Final focused payment suite, including four additional gateway transport/error cases | 25 passed, 1 warning, 10.96 seconds |
| Final frontend production build, lint and TypeScript | Passed |
| Fixed server prices and rejected client amount/credit injection | Passed |
| Owned orders, authentication, CSRF and invited-beta restriction | Passed |
| HMAC verification, captured-only fulfillment and exact amount/currency | Passed in integration tests with mocked gateway |
| Duplicate callback/webhook, refunds and test/live separation | Passed in integration tests with mocked gateway |
| Lost callback reconciliation and lost order-create response recovery | Passed in integration tests with mocked gateway |
| Concurrent reservations cannot overspend; failure returns reserved credits | Passed |
| Actual Razorpay test order creation and idempotent reuse | Passed against Razorpay API |
| Actual forged signature and invalid webhook rejection | Passed; unchanged wallet |
| Hosted checkout opening, local login and saved-order recovery | Passed in browser |
| Hosted cancelled netbanking attempt | Gateway reports failed; no credits granted |
| Repeated reconciliation of unpaid real order | Passed; balance remains 3 available, 0 reserved |
| Successful hosted test payment and actual captured-payment credit grant | **Incomplete: authentication stalled** |
| Desktop/mobile layout and keyboard focus | Inspected; mobile scroll width equals client width (375px) |
| Mechanical UI detector, after final changes | No findings |
| Secret scan of source and generated frontend JavaScript | No payment secrets found |
| Diff whitespace check | Passed; only Git line-ending notices |
| PostgreSQL migration execution on Railway | Not performed |
| Automatic delivery from Razorpay to the new webhook endpoint | Not configured locally |

Full test output is in `backend/audit_artifacts/billing-full-suite.log`; the final payment suite is in `backend/audit_artifacts/billing-focused-final.log`. Frontend output is in `backend/audit_artifacts/billing-frontend-build.log`. The full 407-test run preceded the four added transport tests; the later focused run includes those new cases. Existing dependency deprecation/browser compatibility-data warnings remain.

## Real gateway/browser observations

An API-created ₹29 test order was independently fetched from Razorpay with amount 2900 paise and currency INR: `order_TpMyADvBxm158r`. A repeated create request returned the same saved purchase.

The browser created a separate ₹29 order, `order_TpRBkM6Q8R9UUf`, associated with local purchase `4d990f75-e41d-4066-a983-17e3ef06b216`:

- Netbanking attempt `pay_TpRCeHhebIa0T4` stalled at the bank redirect. Cancelling it produced an authoritative gateway `failed` state with a cancellation description.
- Test-card attempt `pay_TpREAIUvqFLTch` stalled at **Sending OTP** and remained `created` when checked. The official Razorpay test Visa card was used, without saving it. The test browser was reloaded to leave the recoverable saved-order page.
- No captured payment was observed. Local account 11 remained at three trial credits with no pack-purchase ledger entries. Two server reconciliation calls did not add unearned credits.

These observations do not establish the root cause of the hosted authentication stall. The payment success path must still be exercised in a supported regular browser, with gateway and browser evidence, before live acceptance. The connected read-only Razorpay plugin could not find the API-created order, although the API with the supplied test key could; the connected merchant context may differ. The implementation uses the explicitly supplied test-key account.

## Screenshots

Saved under `C:/Users/pilla/Documents/Codex/2026-10-13/r/outputs/payments-2026-10-18/`:

- `pricing-desktop.jpg`: final homepage prices and pack cards.
- `pricing-mobile.jpg`: final mobile pack layout and visible keyboard focus.
- `checkout-unpaid.jpg`: honest unpaid-order status and unchanged test balance.

## Before accepting live payments

1. Complete a hosted successful test payment and confirm the actual captured Razorpay payment grants exactly one pack. Replay its callback/reconcile and verify the balance stays unchanged.
2. Configure the matching merchant's public webhook, test real delivery/replay, and verify refund reconciliation. The route and automated tests already exist.
3. Back up the target database and apply the additive migration. Deploy both services together with the beta allowlist intact.
4. Configure merchant support/refund terms, activate the merchant account, and switch explicitly to live-mode keys and live webhook only when ready. Test credits remain isolated.

Implementation/configuration details and the launch-price rationale are in [PAYMENTS.md](PAYMENTS.md).
