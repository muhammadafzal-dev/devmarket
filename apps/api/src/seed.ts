import { env } from "./config.js";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
if (env.NODE_ENV === "production" || env.PAYMENT_MODE === "stripe")
  throw new Error("Demo seed is available only in local demo mode");
const db = new PrismaClient();
try {
  const passwordHash = await bcrypt.hash("DemoPass123!", 12);
  for (const [role, email, name] of [
    ["CLIENT", "buyer@devmarket.local", "Alex Morgan"],
    ["DEVELOPER", "developer@devmarket.local", "Jordan Lee"],
    ["ADMIN", "admin@devmarket.local", "Sam Admin"],
  ])
    await db.user.upsert({
      where: { email },
      update: {},
      create: {
        email: email!,
        name: name!,
        role: role!,
        passwordHash,
        emailVerified: true,
        ...(role === "DEVELOPER"
          ? {
              connectAccountId: "demo_account_seed_developer",
              connectReady: true,
              connectMode: "demo",
            }
          : {}),
      },
    });
  const seller = await db.user.findUniqueOrThrow({
    where: { email: "developer@devmarket.local" },
  });
  const listings = [
    [
      "React performance tune-up",
      "I will audit your React application, identify expensive renders, and deliver focused fixes with a before-and-after report.",
      "Frontend",
      12500,
      3,
    ],
    [
      "A polished landing page",
      "A responsive, accessible landing page for your product, built with clean React components and thoughtful interactions.",
      "Frontend",
      25000,
      5,
    ],
    [
      "Node.js API rescue",
      "Fix a stubborn backend bug, improve error handling, and add regression tests so your API behaves reliably.",
      "Backend",
      15000,
      3,
    ],
    [
      "PostgreSQL query optimization",
      "Investigate slow queries, improve indexes, and explain the changes with practical EXPLAIN plans.",
      "Database",
      18000,
      4,
    ],
    [
      "Connect payment integration",
      "Build a Stripe sandbox checkout flow with signed webhook handling and a clear integration guide.",
      "Payments",
      35000,
      7,
    ],
    [
      "Accessibility essentials audit",
      "Review keyboard navigation, labels, contrast, and screen reader semantics with actionable improvements.",
      "Design",
      9500,
      2,
    ],
  ] as const;
  for (const [
    i,
    [title, description, category, priceCents, deliveryDays],
  ] of listings.entries())
    await db.service.upsert({
      where: { id: `seed-service-${i + 1}` },
      update: {},
      create: {
        id: `seed-service-${i + 1}`,
        title,
        description,
        category,
        priceCents,
        deliveryDays,
        sellerId: seller.id,
        published: true,
      },
    });
  console.log(
    "Seed ready: buyer@devmarket.local / developer@devmarket.local / admin@devmarket.local — DemoPass123!",
  );
} finally {
  await db.$disconnect();
}
