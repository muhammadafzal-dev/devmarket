# Security model and review

## Enforced boundaries

- Session tokens are random and stored hashed. Cookies are HttpOnly and SameSite, and Secure in production.
- Passwords use bcrypt. Verification/reset tokens expire and are single use, with hashes stored in token records. Password reset revokes existing sessions.
- Browser mutations require the configured trusted Origin. Webhooks bypass this browser check only because they require Stripe signature verification against the raw body.
- Registration cannot assign ADMIN. Order and service routes check ownership in addition to role.
- Monetary values come from persisted server snapshots; the browser cannot choose the seller, transfer amount or commission for an order.
- Database transitions reserve financial operations, preventing competing refund/release requests. Stable provider keys protect retries.
- Webhook IDs are stored for deduplication; payment events must match provider identity, amount and currency.
- Demo payments are disabled in production and unavailable in Stripe mode. Live Stripe secret keys are rejected for this learning build.
- Card details and identity documents use hosted Stripe forms. Delivery links allow HTTPS; user content is rendered as text.
- API error responses omit provider secrets and internal stack traces. Secrets belong in ignored environment files.

## Local teaching conveniences

The development mailbox intentionally displays verification/reset URLs for local test accounts. Those URLs are bearer credentials and must never be publicly exposed. Use the app only on your machine in development. The local PostgreSQL helper uses trust authentication bound to loopback; Docker uses development-only credentials. Seeded accounts use a shared, documented password.

Registration/reset in a production environment are blocked until a real email transport exists. The local mailbox is not a production mail system. Do not deploy the development server or seed dataset to a public host.

## Financial limitations that remain operational work

A database commit and a remote Stripe request cannot be one atomic transaction. Crashes between them require reconciliation. A retry is safe only while it uses the same operation identity within provider guarantees. If the provider outcome is unknown, freeze competing money movement and inspect provider records. Do not report a pending refund as successful.

Post-transfer refunds, partial refunds and dispute resolution are manual-review scope in this version. A closed dispute is not automatically treated as permission to pay a seller. Hosted onboarding readiness may change; the server refreshes provider state before transfer.

## Review checklist and evidence

Review authorization per route, secret serialization, trusted-origin enforcement, token lifecycle, price tampering, invalid transitions, duplicate/concurrent release, refund versus release, mode changes, webhook authenticity and delayed events. The automated and browser results are recorded in `docs/verification.md`; that report distinguishes code review from executed tests.

## Before a public deployment

Replace local email delivery and seed credentials, restrict infrastructure networking, introduce versioned migrations and backups, enable TLS, configure production logs/alerts, add durable reconciliation workers and provider balance monitoring, set retention policies and abuse controls, verify Stripe country/capability eligibility and perform an end-to-end sandbox acceptance run. These are separate deployment requirements; this build is intended for local practice.
