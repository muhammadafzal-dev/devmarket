# DevMarket Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement the bounded tasks below. User explicitly authorized parallel agents and local implementation before Stripe setup.

**Goal:** Build a documented, runnable freelance marketplace with demo payments and a real Stripe Connect sandbox integration.

**Architecture:** A yarn monorepo hosts a React frontend and Express API with PostgreSQL persistence. The API enforces permissions and order transitions; a gateway separates local payment simulation from Stripe. Shared contracts document all integration boundaries.

**Tech Stack:** Node.js 22, TypeScript, yarn, React, Vite, Express, Prisma 6, PostgreSQL 17, Stripe SDK, Vitest.

**Spec:** `spec/features/devmarket.md`; interface details: `docs/api-contract.md`.

## Global Constraints
- Money is integer USD cents, 10% platform fee rounded down.
- No Stripe credentials needed to install, build, test or use demo mode.
- Demo mode forbidden in production; this exercise supports sandbox Stripe keys only.
- Behavior changes need specs; security review required; tests use isolated state and run in parallel.
- Existing sibling projects are untouched. No credentials or attribution in commits.

## File map and task ownership
- Root package/workspace/compose/tsconfig/.env.example and scripts: coordinator.
- `packages/database/prisma/schema.prisma`, database package client: backend worker; persistent User, Session, AuthToken, Service, Order, OrderEvent, WebhookEvent plus operations as needed.
- `packages/contracts/src/index.ts`: backend worker; API public types and validation where useful.
- `apps/api/src/config.ts`, `app.ts`, `server.ts`, `auth/*`, `services/*`, `orders/*`, `connect/*`, `admin/*`, `seed.ts`, `*.test.ts`: backend worker.
- `apps/api/src/payments/gateway.ts` and `gateway.test.ts`: payment worker, no database writes.
- `apps/web/src/{App,main}.tsx`, API client, page components/styles, HTML, package and Vite config: frontend worker.
- `README.md`, `docs/{architecture,learning-guide,stripe-setup,security,verification}.md`: coordinator.

### Task 1: Durable specification and runnable foundation
- [x] Define roles, flows, invariants, screens, exception behavior and public API in the referenced documents.
- [x] Create yarn workspace, root commands, environment template and PostgreSQL compose service.
- [ ] Install dependencies after agent package definitions exist. Run `yarn install`, then `yarn db:generate`.
- [ ] Start isolated local PostgreSQL on port 5433; run `yarn db:push && yarn db:seed`. Expected: repeatable seeded users and published demo services.

### Task 2: Identity, marketplace and order API
Consumes gateway signatures in docs/api-contract.md; produces all documented JSON endpoints and persistent schema.
- [ ] Create schema and app factory with injectable Prisma/gateway so tests isolate state.
- [ ] Test register role escalation (ADMIN -> 400), foreign order read (403/404), unauthenticated mutation (401), wrong Origin (403).
- [ ] Implement session cookies, slow hashes, hashed verification/reset tokens, local mailbox, expiry, revocation, auth rate limits.
- [ ] Implement services with seller ownership, validation and immutable order monetary snapshots.
- [ ] Test client submits `totalCents:1` on a $100 listing: order remains 10000 cents and fee 1000 cents.
- [ ] Implement checkout and verified event processing, preserving provider identity and using transactions/conditional updates for concurrency.
- [ ] Test paid -> start -> deliver -> revise -> deliver -> release. Assert transfer amount 9000 cents and repeated/concurrent release creates at most one transfer.
- [ ] Implement cancellation and pre-transfer refunds with race exclusion; test refund vs release cannot both succeed.
- [ ] Add connect status/onboarding, earnings and admin summaries without exposing secrets.
- [ ] Seed buyer/developer/admin and a catalog for local practice, protected against production seed execution.
- [ ] Run `yarn workspace @devmarket/api typecheck` and `yarn test` with unique database schemas per suite.

### Task 3: Stripe and demo adapters
Consumes CheckoutInput/TransferInput/RefundInput; produces PaymentGateway and normalized PaymentEvent.
- [ ] Implement SDK-backed platform Checkout with card payments, order metadata and stable idempotency key.
- [ ] Implement Express connected account and hosted onboarding; query readiness from Stripe.
- [ ] Implement source-linked transfer and refund with stable keys.
- [ ] Verify raw-body webhook signatures and normalize relevant checkout/payment/refund/dispute/account events.
- [ ] Test SDK arguments include the immutable amount, source_transaction and idempotency keys. Test invalid signature rejection and payment event normalization.
- [ ] Implement explicit demo provider with no network calls and fail-closed production guard. Reject live Stripe keys.
- [ ] Run adapter tests, report events and limitations to backend worker.

### Task 4: Complete frontend
Consumes documented HTTP API; produces responsive, accessible screens.
- [ ] Create marketplace with search, category filters, service detail and purchase requirements.
- [ ] Create registration/login/verification/reset, local mailbox, session-aware navigation and error states.
- [ ] Add client/developer workspace, order detail with timeline, delivery/revision/release/refund controls.
- [ ] Add explicit simulated checkout, success/cancel handling and clear demo badge. Refresh server state after actions.
- [ ] Add seller listing editor, account/onboarding, earnings and admin overview.
- [ ] Confirm all forms show server errors and prevent duplicate submissions; no UI-only authorization assumptions.
- [ ] Run frontend typecheck/build, then browser smoke check desktop and mobile.

### Task 5: Integration, security review and learning documentation
- [ ] Review all routes for authentication, ownership, validated bodies, trusted origins and secret leakage.
- [ ] Independently review payment race handling, webhook deduplication and provider mode isolation.
- [ ] Exercise API workflow and browser workflow with seeded demo users; verify persistent restart behavior.
- [ ] Run `yarn typecheck && yarn test && yarn build`; record exact outcomes and remaining external setup.
- [ ] Write setup, architecture, API, learning walkthrough, Stripe-later setup, failure/recovery guide and security limitations.
- [ ] Show running app and link docs. Explicitly distinguish tested demo behavior from untested real Stripe sandbox integration.

## Review and execution ledger
2026-09-21 (verification): Ran `yarn typecheck` (pass), `yarn build` (pass), `yarn test` against isolated local PostgreSQL (28/28 pass, schema-per-suite). Fixed two defects found during verification: (1) `processEvent` now retries P2034 serialization/write-conflict failures instead of surfacing 409 under concurrent webhook/demo-pay load; (2) `Order.checkoutAttempt` default corrected 1 -> 0 so checkout attempt identities are 0-based (first `_0`, expiry recovery `_1`), matching the attempt-identity spec. Stripe account setup deferred per user; demo-mode behavior is verified, real Stripe sandbox integration remains untested external setup. Git repository initialized to track work.

2026-09-21: Specification and API contract written before parallel implementation. Existing folder is not a git repository; fresh project directory provides isolation, so no worktree or commits are needed. User requested implementation now and Stripe setup later, so no account/setup approval gate is introduced. Parallel boundaries are backend, payment gateway, frontend; coordinator handles integration and review. Product spec covers all accepted features; full Stripe/bank verification remains external setup, not a local build claim.
