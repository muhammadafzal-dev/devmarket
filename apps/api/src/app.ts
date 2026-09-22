import { registerAuthRoutes } from "./auth/routes.js";
import { registerServicesRoutes } from "./services/routes.js";
import { registerOrdersRoutes } from "./orders/routes.js";
import { registerConnectRoutes } from "./connect/routes.js";
import { registerDashboardRoutes } from "./dashboard/routes.js";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { PrismaClient, Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { env, webUrl } from "./config.js";
import type { PaymentGateway, PaymentEvent } from "./payments/gateway.js";
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
} from "./shared.js";
export function createApp(
  db: PrismaClient,
  gateway: PaymentGateway,
  options: {
    webUrl?: string;
    production?: boolean;
  } = {},
) {
  const origin = options.webUrl || webUrl;
  const production = options.production ?? env.NODE_ENV === "production";
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin, credentials: true }));
  const run =
    (fn: (req: Request, res: Response) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction) => {
      void fn(req, res).catch(next);
    };
  const audit = (
    tx: Prisma.TransactionClient,
    id: string,
    action: string,
    message: string,
  ) => tx.orderEvent.create({ data: { orderId: id, action, message } });
  const getOrder = async (id: string) => {
    const o = await db.order.findUnique({ where: { id }, include });
    check(o, "Order not found", 404);
    return o;
  };
  const output = async (id: string) => serializeOrder(await getOrder(id));
  async function processEvent(e: PaymentEvent) {
    // Serializable transactions can fail with P2034 (write conflict / deadlock)
    // under concurrent webhook or demo-pay processing. Retrying is safe because
    // the transaction is idempotent (it exits early on a known webhook event id).
    for (let attempt = 0; ; attempt++) {
      try {
        return await runProcessEvent(e);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2034" &&
          attempt < 5
        ) {
          await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  }
  async function runProcessEvent(e: PaymentEvent) {
    await db.$transaction(
      async (tx) => {
        if (await tx.webhookEvent.findUnique({ where: { id: e.id } })) return;
        if (e.type === "account_updated" && e.accountId)
          await tx.user.updateMany({
            where: { connectAccountId: e.accountId },
            data: { connectReady: e.ready === true },
          });
        else if (e.type !== "ignored") {
          const o = e.orderId
            ? await tx.order.findUnique({ where: { id: e.orderId } })
            : e.paymentIntentId
              ? await tx.order.findUnique({
                  where: { paymentIntentId: e.paymentIntentId },
                })
              : e.chargeId
                ? await tx.order.findUnique({ where: { chargeId: e.chargeId } })
                : null;
          check(o, "Unknown payment reference", 400);
          check(o.paymentMode === gateway.mode, "Payment mode mismatch", 400);
          if (e.type === "paid") {
            check(
              e.amountCents === o.totalCents && e.currency === o.currency,
              "Payment amount or currency mismatch",
              400,
            );
            check(
              !!e.checkoutId &&
                e.checkoutId === o.checkoutId &&
                !!e.paymentIntentId &&
                !!e.chargeId,
              "Payment reference mismatch",
              400,
            );
            check(
              !o.paymentIntentId || o.paymentIntentId === e.paymentIntentId,
              "Payment intent mismatch",
              400,
            );
            const updated = await tx.order.updateMany({
              where: {
                id: o.id,
                status: "AWAITING_PAYMENT",
                paymentStatus: { in: ["UNPAID", "PENDING", "FAILED"] },
              },
              data: {
                status: "PAID",
                paymentStatus: "PAID",
                paymentIntentId: e.paymentIntentId,
                chargeId: e.chargeId,
                financialLock: null,
              },
            });
            if (updated.count)
              await audit(
                tx,
                o.id,
                "PAYMENT_RECEIVED",
                "Payment confirmed by payment provider.",
              );
          } else if (e.type === "failed") {
            check(
              e.checkoutId === o.checkoutId,
              "Payment reference mismatch",
              400,
            );
            await tx.order.updateMany({
              where: {
                id: o.id,
                status: "AWAITING_PAYMENT",
                paymentStatus: { in: ["UNPAID", "PENDING"] },
              },
              data: { paymentStatus: "FAILED" },
            });
          } else if (
            ["refunded", "refund_pending", "disputed"].includes(e.type)
          ) {
            check(
              (e.paymentIntentId && e.paymentIntentId === o.paymentIntentId) ||
                (e.chargeId && e.chargeId === o.chargeId),
              "Payment reference mismatch",
              400,
            );
            if (e.type === "refunded") {
              check(
                e.amountCents === o.totalCents,
                "Partial refund requires reconciliation",
                400,
              );
              await tx.order.update({
                where: { id: o.id },
                data: {
                  paymentStatus: "REFUNDED",
                  status:
                    o.transferStatus === "TRANSFERRED" ? o.status : "CANCELLED",
                  // Clear the mutex on a terminal refund, mirroring the paid path.
                  financialLock: null,
                },
              });
            }
            if (e.type === "refund_pending" && o.paymentStatus !== "REFUNDED")
              await tx.order.update({
                where: { id: o.id },
                data: {
                  paymentStatus: "REFUND_PENDING",
                  financialLock: "refund",
                },
              });
            if (e.type === "disputed" && o.paymentStatus !== "REFUNDED")
              await tx.order.update({
                where: { id: o.id },
                data: { paymentStatus: "DISPUTED" },
              });
            await audit(
              tx,
              o.id,
              e.type.toUpperCase(),
              "Provider reported " + e.type + ".",
            );
          }
        }
        await tx.webhookEvent.create({ data: { id: e.id } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json", limit: "1mb" }),
    run(async (req, res) => {
      check(gateway.mode === "stripe", "Unavailable", 404);
      let event;
      try {
        event = await gateway.parseWebhook(
          req.body,
          req.header("stripe-signature") || "",
        );
      } catch {
        throw new HttpError(400, "Invalid webhook signature or payload");
      }
      await processEvent(event);
      res.json({ received: true });
    }),
  );
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.header("origin") !== origin
    )
      return res.status(403).json({ error: "Untrusted request origin" });
    next();
  });
  app.use((req, res, next) => {
    void (async () => {
      const raw = req.cookies?.session;
      if (raw) {
        const s = await db.session.findUnique({
          where: { id: hash(raw) },
          include: { user: true },
        });
        if (s && s.expiresAt > new Date())
          res.locals.user = {
            ...s.user,
            connectReady:
              s.user.connectReady && s.user.connectMode === gateway.mode,
          };
      }
      next();
    })().catch(next);
  });
  const user = (res: Response) => {
    const u = res.locals.user as User | undefined;
    check(u, "Sign in required", 401);
    return u;
  };
  const verified = (res: Response) => {
    const u = user(res);
    check(u.emailVerified, "Verify your email first", 403);
    return u;
  };
  const developer = (res: Response) => {
    const u = verified(res);
    check(u.role === "DEVELOPER", "Developer role required", 403);
    return u;
  };
  const actorOrder = async (req: Request, res: Response) => {
    const u = user(res),
      o = await getOrder(String(req.params.id));
    check(
      u.role === "ADMIN" || o.buyerId === u.id || o.sellerId === u.id,
      "Access denied",
      403,
    );
    return { u, o };
  };
  const setSession = async (res: Response, id: string) => {
    const raw = token();
    await db.session.create({
      data: {
        id: hash(raw),
        userId: id,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    res.cookie("session", raw, {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 7 * 86400000,
      path: "/",
    });
  };
  const sendToken = async (u: User, kind: string) => {
    const raw = token();
    await db.$transaction(async (tx) => {
      await tx.authToken.deleteMany({ where: { userId: u.id, kind } });
      await tx.authToken.create({
        data: {
          id: hash(raw),
          userId: u.id,
          kind,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      if (!production)
        await tx.mail.create({
          data: {
            to: u.email,
            subject:
              kind === "verify" ? "Verify your email" : "Reset your password",
            url: `${origin}/${kind === "verify" ? "verify-email" : "reset-password"}?token=${raw}`,
          },
        });
    });
  };
  app.get("/api/health", (_req, res) =>
    res.json({ ok: true, paymentMode: gateway.mode }),
  );
  const context = {
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
  };
  registerAuthRoutes(context);
  registerServicesRoutes(context);
  registerOrdersRoutes(context);
  registerConnectRoutes(context);
  registerDashboardRoutes(context);
  app.use((_req, res) => res.status(404).json({ error: "Endpoint not found" }));
  app.use(
    (error: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({
            error: error.errors
              .map((e) => `${e.path.join(".")}: ${e.message}`)
              .join("; "),
          });
      if (error instanceof HttpError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002")
          return res.status(409).json({ error: "Record already exists" });
        if (error.code === "P2034")
          return res
            .status(409)
            .json({ error: "Concurrent operation; please retry" });
      }
      // Log unexpected errors with request context (no bodies/headers) so failed
      // transfers/refunds leave a server-side trace beyond the order audit rows.
      console.error(
        `Unhandled error on ${req.method} ${req.path}:`,
        error instanceof Error ? error.stack || error.message : error,
      );
      res
        .status(500)
        .json({
          error:
            "Operation could not be completed. Retry or inspect server configuration.",
        });
    },
  );
  return Object.assign(app, { routeContext: context });
}
export type RouteContext = ReturnType<typeof createApp>["routeContext"];
