# Verification report

This records what was **actually executed and passed** versus what remains **untested external setup**. It is the honest boundary between the demo behavior this build guarantees and the real Stripe sandbox integration that needs credentials.

_Last run: 2026-09-21._

## How to reproduce

```bash
yarn install
yarn db:generate
yarn db:local:start      # starts a local PostgreSQL from .env DATABASE_URL
yarn db:push
yarn db:seed             # buyer/developer/admin @devmarket.local — DemoPass123!
yarn typecheck
yarn test
yarn build
```

The local database port is derived from `.env` `DATABASE_URL` (default 5433; this machine uses 5435 because Docker occupies 5432–5434). Tests read the same `.env`, so no manual `DATABASE_URL` export is required.

## Verified (executed, passing)

| Gate | Command | Result |
|------|---------|--------|
| Type checking, all packages | `yarn typecheck` | Pass |
| Production builds (api + web) | `yarn build` | Pass |
| API + payment-adapter tests | `yarn test` | **28/28 pass** |

The API suite runs concurrently with **schema-per-suite isolation** (a unique `test_<uuid>` PostgreSQL schema per file), and covers the spec's required cases:

- Authentication, role, trusted-Origin and ownership enforcement; ADMIN self-registration rejected.
- Price tampering ignored — a `totalCents:1` body on a $100 listing still yields a 10000-cent order and 1000-cent fee (values derive from the listing snapshot).
- Self-purchase rejected; email verification required for financial mutations and publishing.
- Full order lifecycle: paid → start → deliver → revise → deliver → release, asserting a **9000-cent** transfer.
- Concurrent and repeated release create **at most one** transfer; refund and release are mutually exclusive.
- Checkout recovery: open/expired/complete provider states, attempt-identity increment, and reconciliation gating.
- Webhook validation: amount/currency/reference mismatch rejection, deduplication of duplicate/stale events, and no regression of refunded/disputed/completed states.
- Provider-mode isolation and demo APIs disabled in production / Stripe mode.
- Stripe adapter tested against a **stub SDK with no credentials**, asserting immutable amounts, `source_transaction`, and stable idempotency keys, plus invalid-signature rejection and event normalization.

### Defects found and fixed during verification

1. **Serialization retries** — `processEvent` ran a Serializable transaction that surfaced `P2034` (write conflict / deadlock) as a `409` under concurrent webhook/demo-pay load. It now retries the idempotent transaction (it exits early on a known webhook event id). 
2. **Checkout attempt identity** — `Order.checkoutAttempt` default was `1`; corrected to `0` so attempt identities are 0-based (first checkout `_0`, expiry recovery `_1`), matching the attempt-identity contract used for idempotency keys.

## NOT verified (requires external setup)

The real Stripe sandbox path is implemented but **exercised only through a stub SDK**. None of the following ran against Stripe's servers:

- Live hosted Checkout, Connect Express onboarding, and account-capability readiness.
- Real webhook signature verification against `STRIPE_WEBHOOK_SECRET` / `STRIPE_CONNECT_WEBHOOK_SECRET` with raw bodies.
- Real transfers (`source_transaction`) and refunds, including dispute freezes and reconciliation of ambiguous failures.
- Bank payouts (distinct from transfers to the connected balance).

To exercise these, follow [stripe-setup.md](stripe-setup.md) with sandbox keys. This build accepts **`sk_test_` keys only** and refuses live keys.

## Not automated (manual / future work)

- **Browser smoke checks** (client payment → developer delivery → client release, and narrow-screen rendering) are described in the plan but have no automated E2E harness yet.
- **Frontend** has no component/interaction tests; it is covered only by typecheck and build.
