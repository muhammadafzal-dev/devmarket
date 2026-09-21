# DevMarket behavior specification

## Product and scope
A complete local learning marketplace for fixed-price development services. Users buy services, onboard as developers, publish services, deliver work, request revisions and explicitly release the developer share. Start in clearly labeled demo mode; implement the real Stripe sandbox adapter now, configure credentials later. This is a learning app, not a claim of live-payment readiness. One seller and one payment per order; USD only; a 10% commission, integer cents rounded down. No subscriptions, multi-seller carts, milestone payments, chat, file upload or automatic acceptance. Deliveries use text and optional HTTPS links. Stripe bank payouts are distinct from transfers.

## Identity and access
Registration creates a client or developer, never an administrator. A developer may buy other developers' services. Email/password login uses a slow password hash, opaque server-side sessions in HttpOnly SameSite cookies, expiration and logout revocation. Password reset tokens and email verification tokens are random, hashed at rest, single-use and expiring. Local development exposes delivery links only through a local development mailbox, never public production responses. Changing a password revokes sessions. Mutating browser requests require trusted Origin protection; webhook requests use Stripe signature verification instead. Rate limit authentication. Never return password hashes, token hashes or secret keys in JSON. Administrators are seed-only for this exercise. Verified email required for financial mutations and publishing.

## Services
Public visitors browse published listings and search/filter by category. Developers create/edit only their own services, including title, description, category, price in cents and delivery days; publication requires onboarding readiness. Unpublished listings are private to their owner/admin. Existing orders retain immutable title, price, seller and fee snapshots. Self-purchase is rejected.

## Onboarding
An authenticated developer starts hosted Connect onboarding, sees pending/ready status and can refresh status. Demo onboarding simulates readiness explicitly. Stripe readiness derives from current account capabilities and requirements, not the redirect URL. Persist the account ID and prevent duplicate account creation with a stable idempotency key. No Stripe account is required for demo mode.

## Orders
A verified buyer creates an order with a listing and requirements. The API derives monetary values from the listing. Only the buyer and seller (or admin) can read an order. Before payment the buyer may cancel. Payment success changes AWAITING_PAYMENT to PAID; seller starts PAID -> IN_PROGRESS. Seller submits IN_PROGRESS -> DELIVERED with a nonempty delivery message. Buyer requests DELIVERED -> IN_PROGRESS with revision notes, or approves DELIVERED -> COMPLETED. Payment release requires successful payment, matching buyer, ready seller account and no dispute/refund. Approval is durable even if transfer needs retry; release retries cannot double-pay. Keep order, payment, transfer states separate. Every mutation appends an audit event visible in the order timeline.

## Payment rules
Separate platform charge and seller transfer. Backend checkout uses the order snapshot and stable operation identity; the return page never marks an order paid. Successful verified webhook must match expected order, amount, currency and provider reference. Duplicate/stale webhooks must be harmless. Transfer amount equals total minus commission; uses the successful charge as source_transaction. Transfer and refund have persisted attempt state and stable idempotency keys; ambiguous failures require reconciliation before creating a fresh operation. Mutually exclude release and refund, including concurrent requests. Payment rows retain provider mode; changing deployment mode must not operate on orders from another mode. Preserve the provider references for audit/recovery.

Demo checkout has an explicit confirmation screen/action; it uses the same order invariants as Stripe confirmation. Demo APIs unavailable in Stripe/production mode. Simulate success/failure for learning, clearly labeled as no real money.

## Refunds and disputes
Buyer/admin can cancel an unpaid order; buyer can refund PAID before seller starts. Admin can refund paid/in-progress/delivered orders before transfer after reviewing reason. For this version, transferred orders cannot be refunded automatically: show a clear support/reconciliation message and document reversal workflow. Freeze release when a charge dispute is open; admins see dispute status. A refund success must be confirmed or recorded from provider result; never label a pending provider refund successful. Do not regress refunded/disputed/completed states on delayed events.

## Screens
Public marketplace and service detail; sign in/up; verification/reset; client/developer dashboard; orders list and order detail timeline; service editor; account/onboarding and earnings; admin overview with orders, totals and audit visibility; development mailbox. Responsive keyboard-usable layouts, labeled inputs, useful loading/error/empty states, no silent failed actions. Navigation and role-sensitive controls reflect API permissions but never substitute for them.

## Verification
Test anonymous/foreign-user denial, admin escalation rejection, trusted-origin enforcement, expired/reused auth tokens, reset session revocation, price tampering, self-purchase, invalid state changes, revision/delivery flow, duplicate and concurrent release, refund/release conflict, webhook signature/amount/currency/reference mismatch and duplicate events. Test payment adapter with a stub SDK without credentials. API integration tests isolate database state and may run concurrently. Build and typecheck all packages. Browser smoke checks exercise client payment -> developer delivery -> client release and narrow-screen rendering.
