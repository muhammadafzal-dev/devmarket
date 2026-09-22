import { beforeAll, afterAll, describe, it, expect } from "vitest";
import request from "supertest";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createApp } from "./app.js";
import {
  DemoPaymentGateway,
  type PaymentGateway,
  createPaymentGateway,
} from "./payments/gateway.js";
import { env } from "./config.js";
const schema = "test_" + randomUUID().replaceAll("-", "");
const url = new URL(
  env.DATABASE_URL ||
    "postgresql://devmarket:devmarket@localhost:5433/devmarket",
);
url.searchParams.set("schema", schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const gateway = createPaymentGateway({
  PAYMENT_MODE: "demo",
  NODE_ENV: "test",
});
const app = createApp(db, gateway);
const origin = "http://localhost:5173";
const api = request(app);
let buyer: string,
  seller: string,
  admin: string,
  serviceId: string,
  buyerId: string,
  sellerId: string;
const post = (path: string, cookie: string, body: object = {}) =>
  api
    .post("/api" + path)
    .set("Origin", origin)
    .set("Cookie", cookie)
    .send(body);
async function login(email: string) {
  const r = await post("/auth/login", "", { email, password: "DemoPass123!" });
  expect(r.status).toBe(200);
  return r.headers["set-cookie"][0].split(";")[0];
}
async function order() {
  const r = await post("/orders", buyer, {
    serviceId,
    requirements: "Please implement the project requirements.",
    totalCents: 1,
  });
  expect(r.status).toBe(201);
  return r.body.order;
}
async function paid() {
  const o = await order();
  expect((await post(`/orders/${o.id}/checkout`, buyer)).status).toBe(200);
  expect(
    (await post(`/orders/${o.id}/demo-pay`, buyer, { outcome: "success" }))
      .status,
  ).toBe(200);
  return o;
}
beforeAll(async () => {
  execFileSync(
    process.execPath,
    [
      "../../node_modules/prisma/build/index.js",
      "db",
      "push",
      "--schema",
      "../../packages/database/prisma/schema.prisma",
      "--skip-generate",
    ],
    { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: "pipe" },
  );
  const passwordHash = await bcrypt.hash("DemoPass123!", 4);
  const b = await db.user.create({
    data: {
      name: "Buyer",
      email: "buyer@test.local",
      passwordHash,
      emailVerified: true,
    },
  });
  buyerId = b.id;
  const s = await db.user.create({
    data: {
      name: "Seller",
      email: "seller@test.local",
      passwordHash,
      emailVerified: true,
      role: "DEVELOPER",
      connectReady: true,
      connectMode: "demo",
      connectAccountId: "demo_account_test",
    },
  });
  sellerId = s.id;
  await db.user.create({
    data: {
      name: "Admin",
      email: "admin@test.local",
      passwordHash,
      emailVerified: true,
      role: "ADMIN",
    },
  });
  serviceId = (
    await db.service.create({
      data: {
        title: "Build an API",
        description: "Implement a robust backend service.",
        category: "Backend",
        priceCents: 10000,
        deliveryDays: 3,
        published: true,
        sellerId: s.id,
      },
    })
  ).id;
  [buyer, seller, admin] = await Promise.all(
    ["buyer@test.local", "seller@test.local", "admin@test.local"].map(login),
  );
}, 30000);
afterAll(async () => {
  await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await db.$disconnect();
});
describe.concurrent("marketplace security and money invariants", () => {
  it("enforces authentication, roles, origins and ownership", async () => {
    expect((await api.post("/api/orders").send({})).status).toBe(403);
    expect((await post("/orders", "", {})).status).toBe(401);
    expect(
      (
        await post("/auth/register", "", {
          name: "Evil",
          email: "evil@test.local",
          password: "DemoPass123!",
          role: "ADMIN",
        })
      ).status,
    ).toBe(400);
    const o = await order();
    expect((await post(`/orders/${o.id}/start`, buyer)).status).toBe(403);
    expect(
      (await api.get("/api/admin/overview").set("Cookie", buyer)).status,
    ).toBe(403);
    expect(
      (
        await post("/orders", seller, {
          serviceId,
          requirements: "I buy my own service.",
        })
      ).status,
    ).toBe(400);
  });
  it("uses price snapshots and completes delivery/revision with concurrent release once", async () => {
    const o = await paid();
    expect(o.totalCents).toBe(10000);
    expect(o.feeCents).toBe(1000);
    expect((await post(`/orders/${o.id}/release`, buyer)).status).toBe(409);
    expect((await post(`/orders/${o.id}/start`, seller)).status).toBe(200);
    expect(
      (
        await post(`/orders/${o.id}/deliver`, seller, {
          message: "Here is the completed work",
          url: "https://example.com",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await post(`/orders/${o.id}/revise`, buyer, {
          message: "Please change the headline",
        })
      ).status,
    ).toBe(200);
    await post(`/orders/${o.id}/deliver`, seller, {
      message: "Headline has been updated",
    });
    const results = await Promise.all([
      post(`/orders/${o.id}/release`, buyer),
      post(`/orders/${o.id}/release`, buyer),
    ]);
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(
      true,
    );
    const current = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(current.transferStatus).toBe("TRANSFERRED");
    expect(current.sellerCents).toBe(9000);
    expect(
      await db.orderEvent.count({
        where: { orderId: o.id, action: "TRANSFERRED" },
      }),
    ).toBe(1);
    expect(
      (
        await post(`/orders/${o.id}/refund`, admin, {
          reason: "Refund attempted after release",
        })
      ).status,
    ).toBe(409);
  });
  it("mutually excludes refund and release", async () => {
    const o = await paid();
    await post(`/orders/${o.id}/start`, seller);
    await post(`/orders/${o.id}/deliver`, seller, {
      message: "Delivery for race test",
    });
    await Promise.all([
      post(`/orders/${o.id}/release`, buyer),
      post(`/orders/${o.id}/refund`, admin, {
        reason: "Administrator approved refund",
      }),
    ]);
    const current = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(!(current.transferId && current.refundId)).toBe(true);
    expect(["REFUNDED", "PAID"]).toContain(current.paymentStatus);
  });
  it("revokes sessions after password reset and rejects reused/expired tokens", async () => {
    const r = await post("/auth/register", "", {
      name: "New Member",
      email: "new@test.local",
      password: "DemoPass123!",
      role: "CLIENT",
    });
    expect(r.status).toBe(201);
    const cookie = r.headers["set-cookie"][0].split(";")[0];
    const mail = await db.mail.findFirstOrThrow({
      where: { to: "new@test.local" },
    });
    const verification = new URL(mail.url).searchParams.get("token");
    expect(
      (await post("/auth/verify-email", "", { token: verification })).status,
    ).toBe(200);
    expect(
      (await post("/auth/verify-email", "", { token: verification })).status,
    ).toBe(400);
    await post("/auth/forgot-password", "", { email: "new@test.local" });
    const reset = await db.mail.findFirstOrThrow({
      where: { to: "new@test.local", subject: "Reset your password" },
    });
    const raw = new URL(reset.url).searchParams.get("token");
    expect(
      (
        await post("/auth/reset-password", "", {
          token: raw,
          password: "ChangedPass123!",
        })
      ).status,
    ).toBe(200);
    expect((await api.get("/api/auth/me").set("Cookie", cookie)).status).toBe(
      401,
    );
    expect(
      (
        await post("/auth/reset-password", "", {
          token: raw,
          password: "ChangedAgain123!",
        })
      ).status,
    ).toBe(400);
    const expired = "e".repeat(64);
    await db.authToken.create({
      data: {
        id: createHash("sha256").update(expired).digest("hex"),
        kind: "verify",
        userId: buyerId,
        expiresAt: new Date(0),
      },
    });
    expect(
      (await post("/auth/verify-email", "", { token: expired })).status,
    ).toBe(400);
  });
  it("rejects foreign users reading orders", async () => {
    const r = await post("/auth/register", "", {
      name: "Stranger",
      email: "stranger@test.local",
      password: "DemoPass123!",
      role: "CLIENT",
    });
    const cookie = r.headers["set-cookie"][0].split(";")[0];
    const o = await order();
    expect(
      (await api.get(`/api/orders/${o.id}`).set("Cookie", cookie)).status,
    ).toBe(403);
  });
  it("cancels an open checkout safely and rejects subsequent payment", async () => {
    const o = await order();
    await post(`/orders/${o.id}/checkout`, buyer);
    expect(
      (
        await post(`/orders/${o.id}/cancel`, buyer, {
          reason: "The scope is no longer needed",
        })
      ).status,
    ).toBe(200);
    expect(
      (await post(`/orders/${o.id}/demo-pay`, buyer, { outcome: "success" }))
        .status,
    ).toBe(409);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("CANCELLED");
  });
  it("recovers an expired checkout with a new attempt identity", async () => {
    const o = await order();
    await post(`/orders/${o.id}/checkout`, buyer);
    const provider: PaymentGateway = new DemoPaymentGateway();
    provider.getCheckoutStatus = async () => "expired";
    const isolated = request(createApp(db, provider));
    const response = await isolated
      .post(`/api/orders/${o.id}/checkout`)
      .set("Origin", origin)
      .set("Cookie", buyer)
      .send({});
    expect(response.status).toBe(200);
    const current = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(current.checkoutAttempt).toBe(1);
    expect(current.checkoutId).toBe(`demo_checkout_${o.id}_1`);
  });
  it("does not cancel a checkout that already completed at the provider", async () => {
    const o = await order();
    await post(`/orders/${o.id}/checkout`, buyer);
    const provider: PaymentGateway = new DemoPaymentGateway();
    provider.cancelCheckout = async () => ({ cancelled: false });
    const response = await request(createApp(db, provider))
      .post(`/api/orders/${o.id}/cancel`)
      .set("Origin", origin)
      .set("Cookie", buyer)
      .send({ reason: "Cancel after provider completed" });
    expect(response.status).toBe(409);
    const current = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(current.status).toBe("AWAITING_PAYMENT");
    expect(current.financialLock).toBeNull();
  });
  it("validates event money and references, deduplicates, and never regresses refunds", async () => {
    const o = await order();
    await post(`/orders/${o.id}/checkout`, buyer);
    const current = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    const event = {
      id: `test-event-${o.id}`,
      type: "paid" as const,
      orderId: o.id,
      checkoutId: current.checkoutId!,
      amountCents: o.totalCents,
      currency: "usd",
      paymentIntentId: `pi_${o.id}`,
      chargeId: `ch_${o.id}`,
    };
    await expect(
      app.routeContext.processEvent({ ...event, amountCents: 1 }),
    ).rejects.toThrow("amount");
    await expect(
      app.routeContext.processEvent({ ...event, currency: "eur" }),
    ).rejects.toThrow("currency");
    await expect(
      app.routeContext.processEvent({ ...event, checkoutId: "cs_wrong" }),
    ).rejects.toThrow("reference");
    await app.routeContext.processEvent(event);
    await app.routeContext.processEvent(event);
    expect(
      await db.orderEvent.count({
        where: { orderId: o.id, action: "PAYMENT_RECEIVED" },
      }),
    ).toBe(1);
    expect(
      (
        await post(`/orders/${o.id}/refund`, buyer, {
          reason: "No longer needed before work starts",
        })
      ).status,
    ).toBe(200);
    await app.routeContext.processEvent({ ...event, id: event.id + "late" });
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: o.id } })).paymentStatus,
    ).toBe("REFUNDED");
  });
  it("freezes disputed payments and blocks provider mode changes", async () => {
    const o = await paid();
    await post(`/orders/${o.id}/start`, seller);
    await post(`/orders/${o.id}/deliver`, seller, {
      message: "Complete work for dispute test",
    });
    await app.routeContext.processEvent({
      id: `dispute-${o.id}`,
      type: "disputed",
      orderId: o.id,
      paymentIntentId: `pi_demo_${o.id}`,
      chargeId: `ch_demo_${o.id}`,
    });
    expect((await post(`/orders/${o.id}/release`, buyer)).status).toBe(409);
    const unpaid = await order();
    await db.order.update({
      where: { id: unpaid.id },
      data: { paymentMode: "stripe" },
    });
    expect((await post(`/orders/${unpaid.id}/checkout`, buyer)).status).toBe(
      409,
    );
  });
  it("retries ambiguous transfers within the fence and blocks old attempts", async () => {
    const o = await paid();
    await post(`/orders/${o.id}/start`, seller);
    await post(`/orders/${o.id}/deliver`, seller, {
      message: "Delivery ready for retry test",
    });
    const provider: PaymentGateway = new DemoPaymentGateway();
    let calls = 0;
    provider.transfer = async (input) => {
      calls++;
      if (calls === 1) throw new Error("Unknown network outcome");
      return { id: `demo_transfer_${input.orderId}` };
    };
    const isolated = request(createApp(db, provider));
    const release = () =>
      isolated
        .post(`/api/orders/${o.id}/release`)
        .set("Origin", origin)
        .set("Cookie", buyer)
        .send({});
    expect((await release()).body.order.transferStatus).toBe("FAILED");
    await db.order.update({
      where: { id: o.id },
      data: { transferStartedAt: new Date(Date.now() - 24 * 3600000) },
    });
    expect((await release()).status).toBe(409);
    expect(calls).toBe(1);
    await db.order.update({
      where: { id: o.id },
      data: { transferStartedAt: new Date() },
    });
    expect((await release()).body.order.transferStatus).toBe("TRANSFERRED");
    expect((await release()).body.order.transferStatus).toBe("TRANSFERRED");
    expect(calls).toBe(2);
  });
  it("parks refund/dispute webhooks that arrive during an in-flight transfer", async () => {
    const o = await paid();
    await post(`/orders/${o.id}/start`, seller);
    await post(`/orders/${o.id}/deliver`, seller, {
      message: "Delivered for webhook race test",
    });
    // Simulate a release that has claimed the transfer lock but not yet finalized.
    await db.order.update({
      where: { id: o.id },
      data: {
        status: "COMPLETED",
        financialLock: "transfer",
        transferStatus: "PENDING",
        transferStartedAt: new Date(),
      },
    });
    // A dispute webhook lands mid-transfer: it must not clobber the release.
    await app.routeContext.processEvent({
      id: `race-dispute-${o.id}`,
      type: "disputed",
      orderId: o.id,
      paymentIntentId: `pi_demo_${o.id}`,
      chargeId: `ch_demo_${o.id}`,
    });
    // A refund_pending webhook also lands mid-transfer.
    await app.routeContext.processEvent({
      id: `race-refund-${o.id}`,
      type: "refund_pending",
      orderId: o.id,
      paymentIntentId: `pi_demo_${o.id}`,
      chargeId: `ch_demo_${o.id}`,
    });
    const after = await db.order.findUniqueOrThrow({
      where: { id: o.id },
      include: { events: true },
    });
    // Neither event may mutate the in-flight transfer; both are parked.
    expect(after.paymentStatus).toBe("PAID");
    expect(after.financialLock).toBe("transfer");
    const actions = after.events.map((e) => e.action);
    expect(actions).toContain("DISPUTED_RECONCILIATION");
    expect(actions).toContain("REFUND_PENDING_RECONCILIATION");
  });
  it("withholds publishing and financial mutations until email is verified", async () => {
    const r = await post("/auth/register", "", {
      name: "Unverified Developer",
      email: "unverified@test.local",
      password: "DemoPass123!",
      role: "DEVELOPER",
    });
    const cookie = r.headers["set-cookie"][0].split(";")[0];
    expect((await post("/connect/onboard", cookie)).status).toBe(403);
    expect(
      (
        await post("/orders", cookie, {
          serviceId,
          requirements: "Try ordering without verification",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await post("/services", cookie, {
          title: "New service",
          description: "This should not be published yet",
          category: "Backend",
          priceCents: 5000,
          deliveryDays: 2,
          published: true,
        })
      ).status,
    ).toBe(403);
  });
  it("disables mailbox and demo pay in production", async () => {
    const isolated = request(createApp(db, gateway, { production: true }));
    expect((await isolated.get("/api/dev/mailbox")).status).toBe(404);
    expect(
      (
        await isolated
          .post("/api/orders/anything/demo-pay")
          .set("Origin", origin)
          .send({ outcome: "success" })
      ).status,
    ).toBe(404);
  });
});
