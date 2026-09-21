# Stripe setup — do this later

No step here is needed for the local demo. Complete the demo walkthrough first. The real adapter is implemented, but your platform account, connected accounts and end-to-end Stripe behavior cannot be verified until you provide sandbox configuration.

## 1. Understand the money model

The platform collects a card payment using Stripe-hosted Checkout. After delivery approval, a separate Transfer sends the seller share to a connected Express account. The platform retains its commission before fees, refunds and disputes. Stripe settlement timing still applies. A connected account's later bank payout is a different operation.

This application does not implement legal escrow. Stripe does not provide escrow accounts. Avoid promises of indefinite holding or immediate bank arrival. Check platform country, recipient country, cross-border support and payout timing for your actual business before considering live use.

Sources: [Separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers), [manual payouts and escrow distinction](https://docs.stripe.com/connect/manual-payouts), [Express accounts](https://docs.stripe.com/connect/express-accounts).

## 2. Create the sandbox platform

Create your own Stripe account and enable Connect in a sandbox/test environment. Choose a supported platform country based on your legitimate business details. This code's default connected-account country is US purely for a test configuration; do not fabricate a country or assume your location is supported. Configure STRIPE_ACCOUNT_COUNTRY to the supported sandbox scenario you intend to test.

Use a new database or dedicated test users when switching from demo to Stripe. Simulated connected IDs are not Stripe account IDs. Orders keep their provider mode, and the server must reject using another provider for them. Do not rewrite historical demo orders into Stripe orders.

## 3. Configure backend environment

Keep secrets only in the root ignored `.env`:

```dotenv
PAYMENT_MODE=stripe
STRIPE_SECRET_KEY=sk_test_your_sandbox_secret
STRIPE_WEBHOOK_SECRET=whsec_your_platform_listener_secret
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_your_connect_listener_secret
STRIPE_ACCOUNT_COUNTRY=US
WEB_URL=http://localhost:5173
PORT=4000
```

The Connect secret is optional when your listener supplies one signing secret for all forwarded events; otherwise supply both applicable secrets. Hosted Checkout does not require a frontend publishable key in this implementation. The application deliberately rejects live secret keys. Restart the API after changing environment variables.

## 4. Forward signed webhooks locally

Install the official Stripe CLI, then authenticate using your own sandbox:

```sh
stripe login
stripe listen --forward-to localhost:4000/api/webhooks/stripe \
  --forward-connect-to localhost:4000/api/webhooks/stripe
```

Copy the displayed signing secret(s) into `.env` and restart `yarn dev`. The handler verifies the raw request body before JSON middleware. Use the relevant account scope when registering hosted event destinations later: platform events for charges/checkout/refunds/disputes, connected-account events for onboarding readiness.

The adapter handles checkout completion/async outcomes, payment-intent outcomes, charge refunds, refund updates, charge disputes and account updates. See `apps/api/src/payments/gateway.ts` for the exact event list. Subscription choices must match those implemented cases; unrelated events are safely ignored.

Source: [Stripe webhook setup and local forwarding](https://docs.stripe.com/webhooks).

## 5. Onboard a developer

Register and verify a fresh developer. Use Account -> onboarding. The API creates a connected account and redirects to Stripe-hosted onboarding. Use Stripe's documented test identity values. Return to the app and refresh readiness. Incomplete requirements or unavailable transfer capability must block release. An onboarding return URL alone never marks the developer ready.

Publish a service once ready. A buyer does not need a connected account; only sellers who receive transfers do.

Source: [Testing Connect and verification](https://docs.stripe.com/connect/testing).

## 6. Complete the first Stripe order

1. Sign in as a verified buyer and create a fresh Stripe-mode order.
2. Open hosted Checkout and use Stripe test payment details, such as card `4242 4242 4242 4242`, a future expiration and any valid test CVC.
3. Watch the CLI deliver the event; confirm the order becomes paid only after verified processing.
4. Sign in as the developer, start and deliver the work.
5. Sign in as the buyer and release payment.
6. Inspect the platform charge and Transfer in Stripe, the developer's connected balance and application timeline. Confirm seller amount = order total minus commission.
7. Repeat release and confirm there is still one transfer. A bank payout remains separate and subject to account balance availability/scheduling.

Source: [Stripe test cards](https://docs.stripe.com/testing).

## 7. Test failure paths

- Abandon checkout: no paid status from a return URL.
- Use a declined test card: no seller transfer.
- Send an invalid webhook signature: HTTP 400, no database changes.
- Replay the same valid event: no duplicate state changes or transfers.
- Try delivery/approval with the wrong user: denied by server.
- Refund a new paid order before work starts: verify provider refund and application state.
- Attempt release while refunded/disputed: denied.
- Make seller onboarding incomplete: release remains blocked.

CLI-generated sample events often contain IDs that do not belong to an application order. They test event delivery/signatures but cannot replace creating an order through the app. Unknown references should not create or pay arbitrary orders.

## Recovery and scope boundaries

Provider/network timeout does not prove that Stripe did nothing. Inspect stored operation/provider IDs and Stripe before manually altering state. Never clear a transfer lock and create a new transfer identity merely to remove an error. Stripe idempotency retention is finite; an old ambiguous operation requires reconciliation. Failed/pending refunds, externally created partial refunds, disputes and operations interrupted by process termination need explicit review in this learning version.

Post-transfer refunds are not automated. A real implementation must coordinate transfer reversal, customer refund, balances and accounting, including failures and disputes. This app prevents the automatic pre-transfer refund endpoint from being used after approval/transfer.

Before public deployment: production email, database migrations/backups, TLS, operational reconciliation, suitable account configuration, legal terms and a complete sandbox acceptance run. Live keys remain disabled by design until that separate work is scoped.
