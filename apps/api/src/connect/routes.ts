import type { RouteContext } from "../app.js";
import { check, limiter } from "../shared.js";
export function registerConnectRoutes(ctx: RouteContext) {
  const { app, db, gateway, origin, run, user, developer } = ctx;
  // Onboarding/refresh call the payment provider; throttle them.
  app.use("/api/connect", limiter(120));
  app.get(
    "/api/connect/status",
    run(async (_req, res) => {
      const u = user(res);
      res.json({
        accountId: u.connectAccountId,
        ready: u.connectReady && u.connectMode === gateway.mode,
        mode: gateway.mode,
      });
    }),
  );
  app.post(
    "/api/connect/onboard",
    run(async (_req, res) => {
      const u = developer(res);
      let account =
        u.connectAccountId && u.connectMode === gateway.mode
          ? await gateway.getAccount(u.connectAccountId)
          : await gateway.createAccount({
              userId: u.id,
              email: u.email,
              name: u.name,
            });
      await db.user.update({
        where: { id: u.id },
        data: {
          connectAccountId: account.id,
          connectReady: account.ready,
          connectMode: gateway.mode,
        },
      });
      if (gateway.mode === "demo") {
        return res.json({ demo: true, ready: account.ready });
      }
      res.json(
        await gateway.createOnboardingLink({
          accountId: account.id,
          returnUrl: `${origin}/account?onboarding=returned`,
          refreshUrl: `${origin}/account?onboarding=refresh`,
        }),
      );
    }),
  );
  app.post(
    "/api/connect/refresh",
    run(async (_req, res) => {
      const u = developer(res);
      check(
        u.connectAccountId && u.connectMode === gateway.mode,
        "Start onboarding first",
      );
      const a = await gateway.getAccount(u.connectAccountId);
      await db.user.update({
        where: { id: u.id },
        data: { connectReady: a.ready },
      });
      res.json({ accountId: a.id, ready: a.ready, mode: gateway.mode });
    }),
  );
}
