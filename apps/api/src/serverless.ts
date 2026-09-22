import { env } from "./config.js";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.js";
import { createPaymentGateway } from "./payments/gateway.js";
// Serverless entry (Vercel/Netlify). The persistent server lives in server.ts and
// is unaffected — to run non-serverless later, deploy `node dist/server.js` instead.
//
// Prisma is cached on globalThis so warm invocations reuse one client and do not
// exhaust database connections. Use a POOLED connection string (Neon pooler /
// pgbouncer) for DATABASE_URL in serverless environments.
const cache = globalThis as unknown as { prisma?: PrismaClient };
const prisma = cache.prisma ?? new PrismaClient();
if (!cache.prisma) cache.prisma = prisma;
const app = createApp(prisma, createPaymentGateway(env));
// Vercel's Node runtime accepts an Express app as the default export directly.
export default app;
