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
export function registerAuthRoutes(ctx: RouteContext) {
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
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );
  app.post(
    "/api/auth/register",
    run(async (req, res) => {
      check(!production, "Production email transport is not configured", 503);
      const data = z
        .object({
          name: z.string().trim().min(2).max(80),
          email: z
            .string()
            .email()
            .transform((s) => s.toLowerCase()),
          password: passwords,
          role: z.enum(["CLIENT", "DEVELOPER"]).default("CLIENT"),
        })
        .parse(req.body);
      const u = await db.user.create({
        data: {
          name: data.name,
          email: data.email,
          role: data.role,
          passwordHash: await bcrypt.hash(data.password, 12),
        },
      });
      await sendToken(u, "verify");
      await setSession(res, u.id);
      res
        .status(201)
        .json({
          user: publicUser({
            ...u,
            connectReady: u.connectReady && u.connectMode === gateway.mode,
          }),
        });
    }),
  );
  app.post(
    "/api/auth/login",
    run(async (req, res) => {
      const data = z
        .object({ email: z.string().email(), password: z.string().max(100) })
        .parse(req.body);
      const u = await db.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });
      const valid = await bcrypt.compare(
        data.password,
        u?.passwordHash ||
          "$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW",
      );
      check(u && valid, "Invalid email or password", 401);
      await setSession(res, u.id);
      res.json({
        user: publicUser({
          ...u,
          connectReady: u.connectReady && u.connectMode === gateway.mode,
        }),
      });
    }),
  );
  app.get(
    "/api/auth/me",
    run(async (_req, res) => res.json({ user: publicUser(user(res)) })),
  );
  app.post(
    "/api/auth/logout",
    run(async (req, res) => {
      if (req.cookies.session)
        await db.session.deleteMany({
          where: { id: hash(req.cookies.session) },
        });
      res.clearCookie("session", { path: "/" });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/forgot-password",
    run(async (req, res) => {
      check(!production, "Production email transport is not configured", 503);
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const u = await db.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (u) await sendToken(u, "reset");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/resend-verification",
    run(async (_req, res) => {
      check(!production, "Production email transport is not configured", 503);
      const u = user(res);
      if (!u.emailVerified) await sendToken(u, "verify");
      res.json({ ok: true });
    }),
  );
  for (const kind of ["verify", "reset"])
    app.post(
      `/api/auth/${kind === "verify" ? "verify-email" : "reset-password"}`,
      run(async (req, res) => {
        const data = z
          .object({
            token: z.string().min(32),
            password: kind === "reset" ? passwords : z.string().optional(),
          })
          .parse(req.body);
        // Fail fast: reject an invalid/expired token before paying the bcrypt cost.
        // The transaction below re-checks and single-uses the token authoritatively.
        if (kind === "reset") {
          const existing = await db.authToken.findUnique({
            where: { id: hash(data.token) },
          });
          check(
            existing && existing.kind === kind && existing.expiresAt > new Date(),
            "Invalid or expired token",
            400,
          );
        }
        const passwordHash =
          kind === "reset" ? await bcrypt.hash(data.password!, 12) : undefined;
        await db.$transaction(async (tx) => {
          const t = await tx.authToken.findUnique({
            where: { id: hash(data.token) },
          });
          check(
            t && t.kind === kind && t.expiresAt > new Date(),
            "Invalid or expired token",
            400,
          );
          const deleted = await tx.authToken.deleteMany({
            where: { id: t.id },
          });
          check(deleted.count === 1, "Token already used", 400);
          await tx.user.update({
            where: { id: t.userId },
            data:
              kind === "verify" ? { emailVerified: true } : { passwordHash },
          });
          if (kind === "reset")
            await tx.session.deleteMany({ where: { userId: t.userId } });
        });
        res.json({ ok: true });
      }),
    );
  app.get(
    "/api/dev/mailbox",
    run(async (req, res) => {
      check(
        !production &&
          ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
            req.socket.remoteAddress || "",
          ),
        "Unavailable",
        404,
      );
      res.json({
        messages: await db.mail.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      });
    }),
  );
}
