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
export function registerDashboardRoutes(ctx: RouteContext) {
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
  app.get(
    "/api/dashboard",
    run(async (_req, res) => {
      const u = user(res);
      const orders = await db.order.findMany({
        where: { OR: [{ buyerId: u.id }, { sellerId: u.id }] },
        include,
        orderBy: { createdAt: "desc" },
      });
      res.json({
        stats: {
          spentCents: orders
            .filter((o) => o.buyerId === u.id && o.paymentStatus === "PAID")
            .reduce((s, o) => s + o.totalCents, 0),
          earnedCents: orders
            .filter(
              (o) => o.sellerId === u.id && o.transferStatus === "TRANSFERRED",
            )
            .reduce((s, o) => s + o.sellerCents, 0),
          activeOrders: orders.filter(
            (o) => !["COMPLETED", "CANCELLED"].includes(o.status),
          ).length,
          completedOrders: orders.filter((o) => o.status === "COMPLETED")
            .length,
        },
        orders: orders.map(serializeOrder),
      });
    }),
  );
  app.get(
    "/api/admin/overview",
    run(async (_req, res) => {
      check(user(res).role === "ADMIN", "Admin role required", 403);
      const orders = await db.order.findMany({
        include,
        orderBy: { createdAt: "desc" },
      });
      res.json({
        stats: {
          users: await db.user.count(),
          orders: orders.length,
          volumeCents: orders
            .filter((o) => o.paymentStatus === "PAID")
            .reduce((s, o) => s + o.totalCents, 0),
          feesCents: orders
            .filter((o) => o.transferStatus === "TRANSFERRED")
            .reduce((s, o) => s + o.feeCents, 0),
        },
        orders: orders.map(serializeOrder),
      });
    }),
  );
}
