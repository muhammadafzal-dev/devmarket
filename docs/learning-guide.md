# Learning DevMarket step by step

## 1. Run and explore before configuring Stripe

Follow README setup. Keep PAYMENT_MODE=demo. The catalog, accounts, database, authorization and order workflow are real application code; only the external payment provider is simulated. Open two browser profiles for the buyer and developer to avoid repeatedly signing out.

Read `spec/features/devmarket.md` first, then `docs/api-contract.md`. Watch browser Network requests while using the app. Every state-changing button maps to a server endpoint; hiding a button does not grant security.

## 2. Authentication versus authorization

Register a new account and inspect the development mailbox. Verify the email link. Sign out, request a password reset, follow the new link, and sign in with the new password. Reusing the reset token should fail.

Authentication answers who you are. Authorization answers whether you can perform an action on a particular resource. A developer can deliver only their own order; a buyer can release only their own purchase. An ADMIN value submitted to registration must not create admin access.

Exercise: log out and try loading an order URL. Then sign in as an unrelated account and try the same URL. Neither should disclose the order contents. Read the auth middleware and order ownership checks.

## 3. Seller onboarding and listings

The seeded seller is ready in demo mode. A new developer uses account onboarding to simulate connecting an account, then creates a service. Stripe setup later replaces this simulation with hosted onboarding. Returning from Stripe alone is not sufficient; the backend refreshes actual account readiness.

Edit a service after a buyer creates an order. Verify that the existing order keeps its original price. This is why order snapshots are necessary.

## 4. Checkout and payment confirmation

As buyer, create an order with requirements. Notice that it is awaiting payment; creating an order did not pay for it. Open simulated checkout and choose success. Try failure on a different order and retry.

With Stripe enabled later, checkout is hosted by Stripe. A signed event updates payment state; the return page only reloads state. Inspect the gateway adapter to find amount/currency, metadata and idempotency key. Inspect the webhook route to find raw body signature verification.

Exercise: submit a changed price from browser developer tools. The server still uses saved service/order values.

## 5. Delivery and revisions

As developer, start the paid order and submit a delivery message with an optional HTTPS URL. As buyer, request a revision and supply useful notes. As developer, submit again. The timeline preserves the sequence instead of silently replacing history.

Try delivering before payment, releasing before delivery, or buying your own listing. These transitions must fail at the API, regardless of frontend controls.

## 6. Approve and release

As buyer, approve delivered work. The backend records approval and requests a transfer of the seller share. For a $100 order and 10% commission the transfer is $90. Processing fees affect platform net earnings separately.

Transfer and payout are different: Connect transfer moves platform Stripe balance to connected Stripe balance. Payout moves connected balance to an external bank account on its own schedule. Demo mode has no actual bank transfer.

Exercise: repeat the release request. Inspect the order and transfer reference; there must not be a second payment. Read the persisted operation guard and stable gateway key.

## 7. Refunds and exceptions

Pay for a new order, then refund before the developer starts. Once work starts, use admin review for an eligible pre-transfer refund. Completed/transferred orders cannot use the automatic refund path in this version.

Use a failed demo payment to see recovery. Adapter and integration tests cover scenarios that need provider event injection, including webhook duplicates, invalid signatures and unsafe state changes. After Stripe setup, practice failed test cards, delayed event delivery and disputes.

## 8. Trace a feature through the monorepo

Start at an order action component in `apps/web`. Follow its API request to `apps/api`, through auth/validation, the database operation and payment gateway. Examine the order timeline and response serializer, then read the matching tests. This vertical path explains the architecture more clearly than reading every file sequentially.

## 9. Enable Stripe sandbox when ready

Use `docs/stripe-setup.md`. Keep demo data separate from Stripe practice orders. Complete onboarding, run the webhook listener, and make a new order. Real sandbox verification is a separate acceptance step requiring your Stripe account; local automated tests cannot prove your account/country/capability configuration.

## 10. Further exercises

After understanding the current app, add one feature with a behavior spec and tests at a time: milestone orders, partial refunds with transfer reversals, production email delivery, background reconciliation, seller reviews, or an explicit dispute-resolution workflow. Each adds new money/permission invariants.
