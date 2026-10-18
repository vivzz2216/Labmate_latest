# LabMate experiment packs

The homepage offers one-time purchases through Razorpay Standard Checkout.

| Pack | Total | Experiment credits |
| --- | ---: | ---: |
| Quick Lab | ₹29 | 10 |
| Lab Pack | ₹79 | 35 |
| Semester Pack | ₹149 | 80 |

Each account receives three trial credits per payment mode. Credits have no expiry or recurring charge. One successfully completed experiment consumes one credit. Before starting, the workflow reserves credits for the remaining experiments; settlement returns credits for failed or unfinished experiments. Existing completed report downloads cost no additional credits. A resumed workflow pays only for newly completed experiments. Refunded purchases reverse their proportional credits, rounding up; an account can have a negative balance if refunded credits were already spent.

## Configuration

Set these **backend-only** variables using the server's secret environment store:

```dotenv
BILLING_ENABLED=true
BILLING_TRIAL_CREDITS=3
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=<your test key ID>
RAZORPAY_KEY_SECRET=<your test key secret>
RAZORPAY_WEBHOOK_SECRET=<a separate random webhook secret>
```

Do not put the key secret or webhook secret in frontend variables or source control. The public checkout key ID is returned with an authenticated order. The supplied test credentials are saved only in the ignored local backend environment. The current local test database is separate from Railway.

Apply `backend/migrations/007_experiment_credits.sql` to an existing PostgreSQL installation before enabling packs. The application also creates missing tables at startup through SQLAlchemy. Back up production first. No existing user or workflow rows are rewritten. SQLite local development uses the same models; the SQL migration targets PostgreSQL.

On Railway, configure the backend service variables, retain the database and data volume, and redeploy the backend and frontend together. Keep `EXECUTION_ALLOWED_EMAILS` populated for the controlled beta: purchasing a pack does not grant execution admission. Legacy `/api/run` and task-submit execution routes return 402 while billing is enabled; use the durable `/code-execution` assignment workflow, which enforces reservations.

## Webhooks and reconciliation

On the Razorpay account matching the configured API keys, register:

`https://<public-backend>/api/billing/webhook`

Use the same separate webhook secret stored in the backend and enable `payment.captured`, `order.paid`, `refund.processed`, and `payment.refunded`. The handler verifies HMAC over the untouched body, fetches authoritative payment details, and deduplicates delivery. A local URL is not a public webhook destination. Automatic gateway delivery has not been configured for this local test instance.

The hosted checkout callback verifies its signature against the server-stored order ID, then fetches and, when necessary, captures the payment. Only captured payments add credits. The user can select **Check payment status** to recover a completed payment whose browser callback was lost. Order creation uses a per-user UUID and unique Razorpay receipt to recover a lost create response without silently starting another payment. Neither browser messages nor an unsigned webhook grant credits.

Test and live wallets, orders and ledger entries are separate. To accept real payments, activate the Razorpay merchant account, configure its live webhook and live credentials, explicitly set `RAZORPAY_MODE=live`, and perform a controlled launch check. Test purchases never become live credits. This implementation does not add subscriptions, recurring mandates, automatic refund initiation, or tax invoice generation. Establish the merchant support/refund policy before selling publicly.

## Launch-price rationale

These are starting prices to validate with students, not established willingness-to-pay data. An entry price below ₹30 makes one manual approachable, while larger packs reduce the per-experiment price without promising unlimited AI usage. Keep provider and runtime costs under review during the beta.

Public comparison pages checked on 18 October 2026 advertised [BlackBook](https://www.blackbook.study/) at ₹129 per report, [StudyLab](https://studylab-pearl.vercel.app/) at ₹199 per month, and [ReportOS](https://reportosapp.com/) starter reports at ₹249. These products have different scopes and are directional comparisons. [Razorpay pricing](https://razorpay.com/pricing/) lists processing fees; the pack total shown to students is server-controlled and does not add a checkout surcharge. Validate margins including applicable fees and business tax obligations before changing from test mode.

## Verification

See `PAYMENTS_VERIFICATION_2026-10-18.md` for the exact tested environment, test results, and remaining activation work. The gateway integration follows [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/) and [webhook validation](https://razorpay.com/docs/webhooks/validate-test/).
