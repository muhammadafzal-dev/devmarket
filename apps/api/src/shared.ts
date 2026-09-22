import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { z } from "zod";
import rateLimit from "express-rate-limit";
// Shared limiter for mutating/provider-touching route groups. Skipped under test so
// the concurrent integration suite is not throttled; active in dev and production.
export const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
  });
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  connectAccountId: u.connectAccountId,
  connectReady: u.connectReady,
});
export const include = {
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  events: { orderBy: { createdAt: "asc" as const } },
};
export const person = { seller: { select: { id: true, name: true } } };
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function check(
  condition: unknown,
  message: string,
  status = 409,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export const passwords = z.string().min(12).max(100);
export const serviceSchema = z.object({
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(5000),
  category: z.string().trim().min(2).max(50),
  priceCents: z.number().int().min(500).max(1000000),
  deliveryDays: z.number().int().min(1).max(90),
  published: z.boolean(),
});
export const serializeOrder = (o: any) => {
  const {
    checkoutId,
    checkoutUrl,
    checkoutAttempt,
    paymentIntentId,
    chargeId,
    transferId,
    refundId,
    financialLock,
    transferStartedAt,
    refundStartedAt,
    checkoutStartedAt,
    buyerId,
    sellerId,
    ...safe
  } = o;
  return safe;
};
