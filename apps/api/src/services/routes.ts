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
export function registerServicesRoutes(ctx: RouteContext) {
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
    "/api/services",
    run(async (req, res) => {
      const mine = req.query.mine === "true";
      const services = await db.service.findMany({
        where: {
          ...(mine ? { sellerId: user(res).id } : { published: true }),
          ...(typeof req.query.search === "string"
            ? {
                OR: [
                  {
                    title: {
                      contains: req.query.search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    description: {
                      contains: req.query.search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
          ...(typeof req.query.category === "string" && req.query.category
            ? { category: req.query.category }
            : {}),
        },
        include: person,
        orderBy: { createdAt: "desc" },
      });
      res.json({ services });
    }),
  );
  app.get(
    "/api/services/:id",
    run(async (req, res) => {
      const s = await db.service.findUnique({
        where: { id: String(req.params.id) },
        include: person,
      });
      check(
        s &&
          (s.published ||
            res.locals.user?.id === s.sellerId ||
            res.locals.user?.role === "ADMIN"),
        "Service not found",
        404,
      );
      res.json({ service: s });
    }),
  );
  app.post(
    "/api/services",
    run(async (req, res) => {
      const u = developer(res),
        data = serviceSchema.parse(req.body);
      check(
        !data.published || (u.connectReady && u.connectMode === gateway.mode),
        "Complete seller onboarding before publishing",
      );
      res
        .status(201)
        .json({
          service: await db.service.create({
            data: { ...data, sellerId: u.id },
            include: person,
          }),
        });
    }),
  );
  app.patch(
    "/api/services/:id",
    run(async (req, res) => {
      const u = developer(res),
        data = serviceSchema.partial().parse(req.body),
        s = await db.service.findUnique({
          where: { id: String(req.params.id) },
        });
      check(s && s.sellerId === u.id, "Access denied", 403);
      check(
        !data.published || (u.connectReady && u.connectMode === gateway.mode),
        "Complete seller onboarding before publishing",
      );
      res.json({
        service: await db.service.update({
          where: { id: s.id },
          data,
          include: person,
        }),
      });
    }),
  );
}
