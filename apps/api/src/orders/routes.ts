import { z } from "zod";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import type { RouteContext } from "../app.js";
import {
  hash,
  token,
  publicUser,
  include,
  person,
  HttpError,
  check,
  passwords,
  serviceSchema,
  serializeOrder,
} from "../shared.js";
export function registerOrdersRoutes(ctx: RouteContext) {
  const {
    app,
    db,
    gateway,
    origin,
    production,
    run,
    audit,
    getOrder,
    output,
    processEvent,
    user,
    verified,
    developer,
    actorOrder,
    setSession,
    sendToken,
  } = ctx;
  app.post(
    "/api/orders",
    run(async (req, res) => {
      const u = verified(res),
        data = z
          .object({
            serviceId: z.string(),
            requirements: z.string().trim().min(10).max(5000),
          })
          .parse(req.body);
      const s = await db.service.findUnique({
        where: { id: data.serviceId },
        include: { seller: true },
      });
      check(s?.published, "Service unavailable", 404);
      check(s.sellerId !== u.id, "You cannot purchase your own service", 400);
      check(
        s.seller.connectReady && s.seller.connectMode === gateway.mode,
        "Seller is not ready for payments",
      );
      const fee = Math.floor(s.priceCents / 10);
      const o = await db.order.create({
        data: {
          title: s.title,
          requirements: data.requirements,
          totalCents: s.priceCents,
          feeCents: fee,
          sellerCents: s.priceCents - fee,
          paymentMode: gateway.mode,
          buyerId: u.id,
          sellerId: s.sellerId,
          events: {
            create: {
              action: "ORDER_CREATED",
              message: "Order created; awaiting payment.",
            },
          },
        },
        include,
      });
      res.status(201).json({ order: serializeOrder(o) });
    }),
  );
  app.get(
    "/api/orders",
    run(async (_req, res) => {
      const u = user(res);
      res.json({
        orders: (
          await db.order.findMany({
            where: { OR: [{ buyerId: u.id }, { sellerId: u.id }] },
            include,
            orderBy: { createdAt: "desc" },
          })
        ).map(serializeOrder),
      });
    }),
  );
  app.get(
    "/api/orders/:id",
    run(async (req, res) => {
      const { o } = await actorOrder(req, res);
      res.json({ order: serializeOrder(o) });
    }),
  );
  app.post(
    "/api/orders/:id/checkout",
    run(async (req, res) => {
      let { o, u } = await actorOrder(req, res);
      verified(res);
      check(o.buyerId === u.id, "Only the buyer can pay", 403);
      check(o.paymentMode === gateway.mode, "Payment mode changed");
      check(o.status === "AWAITING_PAYMENT", "Order is not payable");
      if (o.checkoutId) {
        const state = await gateway.getCheckoutStatus(o.checkoutId);
        if (state === "open")
          return res.json(
            gateway.mode === "demo"
              ? { demo: true, orderId: o.id }
              : { url: o.checkoutUrl },
          );
        check(
          state !== "complete",
          "Payment completed; waiting for provider confirmation. Refresh shortly.",
        );
        const reset = await db.order.updateMany({
          where: {
            id: o.id,
            status: "AWAITING_PAYMENT",
            checkoutId: o.checkoutId,
            financialLock: null,
          },
          data: {
            checkoutId: null,
            checkoutUrl: null,
            checkoutStartedAt: null,
            checkoutAttempt: { increment: 1 },
            paymentStatus: "UNPAID",
          },
        });
        check(reset.count, "Order changed; refresh before retrying checkout.");
        o = await getOrder(o.id);
      }
      check(
        !o.checkoutStartedAt ||
          Date.now() - o.checkoutStartedAt.getTime() < 23 * 3600000,
        "Checkout outcome needs administrator reconciliation before retry",
      );
      const claimed = await db.order.updateMany({
        where: {
          id: o.id,
          status: "AWAITING_PAYMENT",
          checkoutId: null,
          financialLock: null,
        },
        data: {
          financialLock: "checkout",
          paymentStatus: "PENDING",
          checkoutStartedAt: o.checkoutStartedAt || new Date(),
        },
      });
      check(claimed.count, "Checkout creation pending. Retry shortly.");
      try {
        const result = await gateway.createCheckout({
          orderId: o.id,
          title: o.title,
          totalCents: o.totalCents,
          currency: o.currency,
          buyerEmail: u.email,
          successUrl: `${origin}/orders/${o.id}?checkout=success`,
          cancelUrl: `${origin}/orders/${o.id}?checkout=cancelled`,
          attempt: o.checkoutAttempt,
        });
        await db.order.update({
          where: { id: o.id },
          data: {
            checkoutId: result.id,
            checkoutUrl: result.url,
            financialLock: null,
          },
        });
        res.json(
          gateway.mode === "demo"
            ? { demo: true, orderId: o.id }
            : { url: result.url },
        );
      } catch (e) {
        await db.order.updateMany({
          where: { id: o.id, financialLock: "checkout" },
          data: { financialLock: null },
        });
        throw e;
      }
    }),
  );
  app.post(
    "/api/orders/:id/cancel",
    run(async (req, res) => {
      const { o, u } = await actorOrder(req, res);
      check(
        u.id === o.buyerId || u.role === "ADMIN",
        "Only the buyer or administrator can cancel",
        403,
      );
      check(o.paymentMode === gateway.mode, "Payment mode changed");
      const { reason } = z
        .object({ reason: z.string().trim().min(5).max(1000) })
        .parse(req.body);
      check(
        o.status === "AWAITING_PAYMENT",
        "Only unpaid orders can be cancelled",
      );
      check(
        !o.checkoutStartedAt || o.checkoutId,
        "Unknown checkout outcome requires reconciliation",
      );
      const claimed = await db.order.updateMany({
        where: {
          id: o.id,
          status: "AWAITING_PAYMENT",
          financialLock: null,
          paymentStatus: { in: ["UNPAID", "PENDING", "FAILED"] },
        },
        data: { financialLock: "cancel" },
      });
      check(claimed.count, "Order changed; refresh before cancelling.");
      try {
        if (o.checkoutId)
          check(
            (await gateway.cancelCheckout(o.checkoutId)).cancelled,
            "Checkout already completed; wait for payment confirmation.",
          );
        await db.$transaction(async (tx) => {
          const changed = await tx.order.updateMany({
            where: {
              id: o.id,
              status: "AWAITING_PAYMENT",
              financialLock: "cancel",
              paymentStatus: { in: ["UNPAID", "PENDING", "FAILED"] },
            },
            data: { status: "CANCELLED", financialLock: null },
          });
          check(
            changed.count,
            "Payment changed while cancelling; refresh this order.",
          );
          await audit(tx, o.id, "CANCELLED", reason);
        });
      } catch (e) {
        await db.order.updateMany({
          where: { id: o.id, financialLock: "cancel" },
          data: { financialLock: null },
        });
        throw e;
      }
      res.json({ order: await output(o.id) });
    }),
  );
  app.post(
    "/api/orders/:id/demo-pay",
    run(async (req, res) => {
      check(!production && gateway.mode === "demo", "Unavailable", 404);
      const { o, u } = await actorOrder(req, res);
      verified(res);
      check(o.buyerId === u.id, "Only buyer can pay", 403);
      check(
        o.paymentMode === "demo" &&
          o.checkoutId &&
          o.status === "AWAITING_PAYMENT",
        "Create checkout first",
      );
      const { outcome } = z
        .object({ outcome: z.enum(["success", "failure"]) })
        .parse(req.body);
      await processEvent({
        id: `demo:${o.id}:${o.checkoutAttempt}:${outcome}`,
        type: outcome === "success" ? "paid" : "failed",
        orderId: o.id,
        checkoutId: o.checkoutId,
        amountCents: o.totalCents,
        currency: o.currency,
        paymentIntentId: `pi_demo_${o.id}`,
        chargeId: `ch_demo_${o.id}`,
      });
      res.json({ order: await output(o.id) });
    }),
  );
  for (const action of ["start", "deliver", "revise"])
    app.post(
      `/api/orders/:id/${action}`,
      run(async (req, res) => {
        const { o, u } = await actorOrder(req, res);
        const seller = action === "start" || action === "deliver";
        check(
          seller
            ? o.sellerId === u.id
            : o.buyerId === u.id || (action === "cancel" && u.role === "ADMIN"),
          "Access denied",
          403,
        );
        const expected =
          action === "start"
            ? "PAID"
            : action === "deliver"
              ? "IN_PROGRESS"
              : action === "revise"
                ? "DELIVERED"
                : "AWAITING_PAYMENT";
        let data: any = {
          status:
            action === "deliver"
              ? "DELIVERED"
              : action === "cancel"
                ? "CANCELLED"
                : "IN_PROGRESS",
        };
        let message: string = action;
        if (action === "deliver") {
          const d = z
            .object({
              message: z.string().trim().min(5).max(5000),
              url: z
                .string()
                .url()
                .refine(
                  (s) => s.startsWith("https://"),
                  "Use an HTTPS delivery link",
                )
                .optional()
                .or(z.literal("")),
            })
            .parse(req.body);
          data = {
            ...data,
            deliveryMessage: d.message,
            deliveryUrl: d.url || null,
          };
          message = d.message;
        }
        if (action === "revise") {
          message = z
            .object({ message: z.string().trim().min(5).max(5000) })
            .parse(req.body).message;
          data.revisionNote = message;
        }
        if (action === "cancel")
          message = z
            .object({ reason: z.string().trim().min(5).max(1000) })
            .parse(req.body).reason;
        await db.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: {
              id: o.id,
              status: expected,
              financialLock: null,
              ...(action === "cancel"
                ? {
                    checkoutId: null,
                    paymentStatus: { in: ["UNPAID", "FAILED"] },
                  }
                : { paymentStatus: "PAID" }),
            },
            data,
          });
          check(
            updated.count,
            "Invalid order state; checkout orders cannot be cancelled until payment is reconciled.",
          );
          await audit(tx, o.id, action.toUpperCase(), message);
        });
        res.json({ order: await output(o.id) });
      }),
    );
  app.post(
    "/api/orders/:id/release",
    run(async (req, res) => {
      const { o, u } = await actorOrder(req, res);
      verified(res);
      check(o.buyerId === u.id, "Only buyer can release payment", 403);
      check(o.paymentMode === gateway.mode, "Payment mode changed");
      if (o.transferStatus === "TRANSFERRED")
        return res.json({ order: serializeOrder(o) });
      check(
        !o.transferStartedAt ||
          Date.now() - o.transferStartedAt.getTime() < 23 * 3600000,
        "Transfer attempt is older than the safe retry window. Administrator reconciliation is required.",
      );
      check(
        o.paymentStatus === "PAID" && o.chargeId,
        "Order payment is not releasable",
      );
      const seller = await db.user.findUniqueOrThrow({
        where: { id: o.sellerId },
      });
      check(
        seller.connectReady &&
          seller.connectMode === gateway.mode &&
          seller.connectAccountId,
        "Seller onboarding is incomplete",
      );
      const account = await gateway.getAccount(seller.connectAccountId);
      check(account.ready, "Seller account is not ready");
      const claimed = await db.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: {
            id: o.id,
            paymentStatus: "PAID",
            OR: [
              { status: "DELIVERED", financialLock: null },
              {
                status: "COMPLETED",
                financialLock: "transfer",
                OR: [
                  { transferStatus: "FAILED" },
                  {
                    transferStatus: "PENDING",
                    updatedAt: { lt: new Date(Date.now() - 60000) },
                  },
                ],
              },
            ],
          },
          data: {
            status: "COMPLETED",
            financialLock: "transfer",
            transferStatus: "PENDING",
            transferStartedAt: o.transferStartedAt || new Date(),
          },
        });
        if (result.count)
          await audit(
            tx,
            o.id,
            "APPROVED",
            "Buyer approved delivery. Developer transfer pending.",
          );
        return result.count;
      });
      if (!claimed) {
        const current = await getOrder(o.id);
        check(
          current.status === "COMPLETED" &&
            current.financialLock === "transfer",
          "Order is not releasable",
        );
        return res.json({ order: serializeOrder(current) });
      }
      try {
        const transfer = await gateway.transfer({
          orderId: o.id,
          amountCents: o.sellerCents,
          currency: o.currency,
          accountId: seller.connectAccountId,
          chargeId: o.chargeId,
        });
        await db.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: o.id },
            data: { transferStatus: "TRANSFERRED", transferId: transfer.id },
          });
          await audit(
            tx,
            o.id,
            "TRANSFERRED",
            "Developer share transferred to connected Stripe balance (not a bank payout).",
          );
        });
      } catch {
        await db.$transaction(async (tx) => {
          await tx.order.updateMany({
            where: { id: o.id, transferStatus: "PENDING" },
            data: { transferStatus: "FAILED" },
          });
          await audit(
            tx,
            o.id,
            "TRANSFER_FAILED",
            "Transfer could not be confirmed. Retry uses the same operation identity.",
          );
        });
      }
      res.json({ order: await output(o.id) });
    }),
  );
  app.post(
    "/api/orders/:id/refund",
    run(async (req, res) => {
      const { o, u } = await actorOrder(req, res);
      verified(res);
      check(u.id === o.buyerId || u.role === "ADMIN", "Access denied", 403);
      check(o.paymentMode === gateway.mode, "Payment mode changed");
      const { reason } = z
        .object({ reason: z.string().trim().min(5).max(1000) })
        .parse(req.body);
      if (o.paymentStatus === "REFUNDED")
        return res.json({ order: serializeOrder(o) });
      check(o.paymentIntentId, "No payment to refund");
      check(
        o.financialLock !== "transfer" && o.transferStatus !== "TRANSFERRED",
        "Transferred or approved orders require support and reconciliation",
      );
      const result = await db.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: {
            id: o.id,
            financialLock: null,
            paymentStatus: "PAID",
            transferStatus: "NOT_RELEASED",
            status: {
              in:
                u.role === "ADMIN"
                  ? ["PAID", "IN_PROGRESS", "DELIVERED"]
                  : ["PAID"],
            },
          },
          data: {
            financialLock: "refund",
            paymentStatus: "REFUND_PENDING",
            refundStartedAt: new Date(),
          },
        });
        if (claimed.count) await audit(tx, o.id, "REFUND_REQUESTED", reason);
        return claimed.count;
      });
      if (!result) {
        check(o.financialLock === "refund", "Order is not refundable");
        return res.json({ order: await output(o.id) });
      }
      try {
        const refund = await gateway.refund({
          orderId: o.id,
          paymentIntentId: o.paymentIntentId,
          amountCents: o.totalCents,
        });
        await db.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: o.id },
            data: {
              refundId: refund.id,
              ...(refund.status === "succeeded"
                ? { paymentStatus: "REFUNDED", status: "CANCELLED" }
                : {}),
            },
          });
          await audit(
            tx,
            o.id,
            "REFUND_" + refund.status.toUpperCase(),
            refund.status === "succeeded"
              ? "Full refund confirmed."
              : "Refund requires provider reconciliation.",
          );
        });
      } catch {
        await db.orderEvent.create({
          data: {
            orderId: o.id,
            action: "REFUND_RECONCILIATION",
            message:
              "Refund outcome unknown; release remains blocked pending reconciliation.",
          },
        });
      }
      res.json({ order: await output(o.id) });
    }),
  );
}
