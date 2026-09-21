# DevMarket
Node 22+, yarn workspaces, React/Vite, Express/TypeScript, PostgreSQL/Prisma.
Read spec/features/devmarket.md and docs/api-contract.md before changing behavior.
Behavior changes need specs; review authorization and payment invariants for every change.
Tests must run in parallel with isolated state (unique users/orders/database schemas).
Do not add Codex attribution to commits. Never commit credentials.
Money is integer USD cents. Prices, ownership, fees and status transitions are server-controlled.
Demo payments must never be enabled in production. Stripe mode accepts sandbox keys only in this learning app.
