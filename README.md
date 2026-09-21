# DevMarket

A full-stack freelance marketplace for learning Stripe Connect, from signup to seller onboarding, checkout, delivery, revisions, approval and transfer. Built as a TypeScript monorepo with React, Express and PostgreSQL.

**Start with demo payments. No Stripe account or API keys are needed.** The same order workflow has a Stripe sandbox adapter ready for configuration later. Demo balances are simulated; no money moves. This project is a learning application, not a certified production payments platform.

## Start locally

Requirements: Node.js 22+, Yarn 4 (via Corepack), and PostgreSQL 17 (Docker Compose is the simplest option).

```sh
cd /Users/gsoft/Desktop/personal/my_dev/devmarket
cp .env.example .env
yarn install
# Skip this if PostgreSQL is already running on localhost:5433.
docker compose up -d
yarn setup
yarn dev
```

Open [DevMarket](http://localhost:5173). The API is on [localhost:4000/api/health](http://localhost:4000/api/health). Vite proxies `/api` so cookie sessions work without extra frontend configuration. The application reads the root `.env`.

If Docker is unavailable but PostgreSQL tools are installed, use the optional local database helper:

```sh
yarn db:local:start
yarn setup
yarn dev
# When finished:
yarn db:local:stop
```

Do not run Docker and the local helper on the same port simultaneously. The local helper binds to 127.0.0.1:5433 and stores its data under ignored `.local/postgres`. It is for local development only.

## Practice accounts

Seeded only for local development. All use **`DemoPass123!`**.

| Role | Email | Try this |
|---|---|---|
| Client | `buyer@devmarket.local` | Purchase, request revisions, approve and release |
| Developer | `developer@devmarket.local` | Manage services, start work, deliver and view earnings |
| Admin | `admin@devmarket.local` | Review orders, disputes and pre-transfer refunds |

Use separate browser profiles or sign out between roles. Registration is also functional; open the development mailbox to verify a new email or reset a password.

## Your first complete flow

1. Sign in as the client, browse a service and enter project requirements.
2. Create the order, open checkout and explicitly simulate a successful payment.
3. Sign in as the developer, open the order, start work and submit a delivery.
4. Sign in as the client. Request a revision if desired, then approve the delivery and release payment.
5. Check the order timeline and developer earnings. For a $100 order, the simulated transfer is $90 and platform commission is $10 before provider costs.

Stripe setup is a separate later step: [Stripe setup guide](docs/stripe-setup.md). Do not enter secrets in the frontend or commit `.env`.

## Documentation

- [Product specification](spec/features/devmarket.md) — features, permissions, money and state rules.
- [Implementation plan](docs/superpowers/plans/2026-09-21-devmarket.md) — work breakdown and verification gates.
- [Architecture](docs/architecture.md) — monorepo, persistence, sessions and payment flow.
- [API contract](docs/api-contract.md) — routes, request bodies and public types.
- [Learning walkthrough](docs/learning-guide.md) — concepts, exercises and failure cases.
- [Stripe setup later](docs/stripe-setup.md) — sandbox prerequisites, variables, webhooks and recovery.
- [Security review](docs/security.md) — protections, boundaries and production work.
- [Verification report](docs/verification.md) — what was actually tested and what requires credentials.

## Commands

| Command | Purpose |
|---|---|
| `yarn dev` | Run frontend and API concurrently |
| `yarn setup` | Generate Prisma, apply local schema and seed |
| `yarn db:generate` | Generate Prisma client |
| `yarn db:push` | Apply schema to local development database |
| `yarn db:seed` | Seed development users and catalog |
| `yarn typecheck` | Typecheck all packages |
| `yarn test` | Run parallel, isolated API and adapter tests |
| `yarn build` | Build API and frontend |

`db:push` is a development convenience. Before deployment, generate and review versioned Prisma migrations and apply them with `prisma migrate deploy` through your deployment pipeline. Never use development seed credentials on a public deployment.

## Project layout

```text
apps/web/                  React application
apps/api/                  Express API, feature modules, integration tests
apps/api/src/payments/     Demo and Stripe payment adapters
packages/contracts/        Shared public contracts
packages/database/         Prisma schema/client
spec/features/             Behavior requirements
docs/                      Architecture, plan, security and learning guides
scripts/                   Local development helpers
```
