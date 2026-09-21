import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { createPaymentGateway, StripePaymentGateway } from "./gateway.js";
const env = {
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
};
function fixture(object: unknown = {}, type = "unknown") {
  const sdk = {
    checkout: {
      sessions: {
        expire: vi.fn().mockResolvedValue({ id: "cs_1", status: "expired" }),
        retrieve: vi.fn().mockResolvedValue({ id: "cs_1", status: "expired" }),
        create: vi
          .fn()
          .mockResolvedValue({
            id: "cs_1",
            url: "https://checkout.stripe.com/test",
          }),
        list: vi.fn().mockResolvedValue({ data: [{ id: "cs_1" }] }),
      },
    },
    accounts: {
      create: vi.fn().mockResolvedValue({ id: "acct_1" }),
      retrieve: vi
        .fn()
        .mockResolvedValue({
          id: "acct_1",
          details_submitted: true,
          payouts_enabled: true,
          capabilities: { transfers: "active" },
          requirements: { currently_due: [], past_due: [] },
        }),
    },
    accountLinks: {
      create: vi
        .fn()
        .mockResolvedValue({ url: "https://connect.stripe.com/test" }),
    },
    transfers: { create: vi.fn().mockResolvedValue({ id: "tr_1" }) },
    refunds: {
      create: vi.fn().mockResolvedValue({ id: "re_1", status: "pending" }),
    },
    paymentIntents: {
      retrieve: vi
        .fn()
        .mockResolvedValue({
          id: "pi_1",
          status: "succeeded",
          latest_charge: "ch_1",
        }),
    },
    charges: {
      retrieve: vi
        .fn()
        .mockResolvedValue({
          id: "ch_1",
          metadata: { orderId: "o1" },
          payment_intent: "pi_1",
        }),
    },
    webhooks: {
      constructEvent: vi
        .fn()
        .mockReturnValue({
          id: "evt_1",
          type,
          livemode: false,
          data: { object },
        }),
    },
  };
  return {
    sdk,
    gateway: new StripePaymentGateway(env, sdk as unknown as Stripe),
  };
}
describe.concurrent("payment gateway", () => {
  it("guards demo production and rejects live/missing Stripe credentials", () => {
    expect(() => createPaymentGateway({ NODE_ENV: "production" })).toThrow(
      "Demo",
    );
    expect(() =>
      createPaymentGateway({
        PAYMENT_MODE: "stripe",
        STRIPE_SECRET_KEY: "sk_live_no",
      }),
    ).toThrow("sandbox");
    expect(() => createPaymentGateway({ PAYMENT_MODE: "invalid" })).toThrow(
      "PAYMENT_MODE",
    );
  });
  it("creates platform card checkout with immutable cents, metadata and operation key", async () => {
    const { sdk, gateway } = fixture();
    await gateway.createCheckout({
      orderId: "o1",
      title: "Service",
      totalCents: 10000,
      currency: "usd",
      buyerEmail: "buyer@example.com",
      successUrl: "http://localhost/success",
      cancelUrl: "http://localhost/cancel",
      attempt: 2,
    });
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_method_types: ["card"],
        payment_intent_data: {
          metadata: { orderId: "o1" },
          transfer_group: "order:o1",
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 10000,
              product_data: { name: "Service" },
            },
          },
        ],
      }),
      { idempotencyKey: "checkout:o1:2" },
    );
  });
  it("links transfer to source charge and uses stable operation identities", async () => {
    const { sdk, gateway } = fixture();
    await gateway.transfer({
      orderId: "o1",
      amountCents: 9000,
      currency: "usd",
      accountId: "acct_1",
      chargeId: "ch_1",
    });
    expect(sdk.transfers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 9000,
        source_transaction: "ch_1",
        destination: "acct_1",
      }),
      { idempotencyKey: "transfer:o1" },
    );
    expect(
      await gateway.refund({
        orderId: "o1",
        paymentIntentId: "pi_1",
        amountCents: 10000,
      }),
    ).toEqual({ id: "re_1", status: "pending" });
    expect(sdk.refunds.create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_1", amount: 10000 }),
      { idempotencyKey: "refund:o1" },
    );
    await gateway.createAccount({
      userId: "u1",
      email: "seller@example.com",
      name: "Seller",
    });
    expect(sdk.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "express" }),
      { idempotencyKey: "account:u1" },
    );
  });
  it("uses capability and requirements readiness", async () => {
    const { sdk, gateway } = fixture();
    expect(await gateway.getAccount("acct_1")).toEqual({
      id: "acct_1",
      ready: true,
    });
    sdk.accounts.retrieve.mockResolvedValueOnce({
      id: "acct_1",
      details_submitted: true,
      payouts_enabled: true,
      capabilities: { transfers: "active" },
      requirements: { currently_due: ["external_account"], past_due: [] },
    });
    expect((await gateway.getAccount("acct_1")).ready).toBe(false);
  });
  it("normalizes paid checkout and fetches successful source charge", async () => {
    const { gateway, sdk } = fixture(
      {
        id: "cs_1",
        mode: "payment",
        payment_status: "paid",
        metadata: { orderId: "o1" },
        amount_total: 10000,
        currency: "usd",
        payment_intent: "pi_1",
      },
      "checkout.session.completed",
    );
    expect(await gateway.parseWebhook(Buffer.from("{}"), "signature")).toEqual({
      id: "evt_1",
      type: "paid",
      orderId: "o1",
      amountCents: 10000,
      currency: "usd",
      checkoutId: "cs_1",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
    });
    expect(sdk.paymentIntents.retrieve).toHaveBeenCalledWith("pi_1");
  });
  it("does not mark an unpaid checkout completed event paid", async () => {
    const { gateway } = fixture(
      { mode: "payment", payment_status: "unpaid" },
      "checkout.session.completed",
    );
    expect(
      (await gateway.parseWebhook(Buffer.from("{}"), "signature")).type,
    ).toBe("ignored");
  });
  it("normalizes intent success with checkout identity and amount received", async () => {
    const { gateway } = fixture(
      {
        id: "pi_1",
        amount_received: 10000,
        currency: "usd",
        metadata: { orderId: "o1" },
        latest_charge: { id: "ch_1" },
      },
      "payment_intent.succeeded",
    );
    expect(await gateway.parseWebhook(Buffer.from("{}"), "sig")).toMatchObject({
      type: "paid",
      checkoutId: "cs_1",
      amountCents: 10000,
      chargeId: "ch_1",
    });
  });
  it.each([
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ])("normalizes %s", async (type) => {
    const { gateway } = fixture(
      {
        id: "cs_1",
        mode: "payment",
        payment_status: "paid",
        payment_intent: "pi_1",
        amount_total: 10000,
        currency: "usd",
        metadata: { orderId: "o1" },
      },
      type,
    );
    expect((await gateway.parseWebhook(Buffer.from("{}"), "sig")).type).toBe(
      type.endsWith("failed") ? "failed" : "paid",
    );
  });
  it("normalizes pending refund and freezes dispute by charge ownership", async () => {
    const refund = fixture(
      {
        amount: 10000,
        currency: "usd",
        charge: "ch_1",
        payment_intent: "pi_1",
        status: "pending",
      },
      "refund.updated",
    );
    expect(
      await refund.gateway.parseWebhook(Buffer.from("{}"), "sig"),
    ).toMatchObject({
      type: "refund_pending",
      orderId: "o1",
      amountCents: 10000,
    });
    const dispute = fixture(
      { amount: 10000, currency: "usd", charge: "ch_1" },
      "charge.dispute.created",
    );
    expect(
      await dispute.gateway.parseWebhook(Buffer.from("{}"), "sig"),
    ).toMatchObject({
      type: "disputed",
      orderId: "o1",
      paymentIntentId: "pi_1",
    });
  });
  it("ignores connected-account payment events and rejects invalid money", async () => {
    const { gateway, sdk } = fixture();
    sdk.webhooks.constructEvent.mockReturnValueOnce({
      id: "evt_1",
      type: "payment_intent.succeeded",
      livemode: false,
      account: "acct_foreign",
      data: { object: {} },
    } as never);
    expect((await gateway.parseWebhook(Buffer.from("{}"), "sig")).type).toBe(
      "ignored",
    );
    await expect(
      gateway.transfer({
        orderId: "o1",
        amountCents: 0.5,
        currency: "usd",
        accountId: "acct_1",
        chargeId: "ch_1",
      }),
    ).rejects.toThrow("integer");
    await expect(
      gateway.transfer({
        orderId: "o1",
        amountCents: 100,
        currency: "eur",
        accountId: "acct_1",
        chargeId: "ch_1",
      }),
    ).rejects.toThrow("USD");
  });
  it("accepts the separately configured Connect secret for account events", async () => {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    vi.spyOn(stripe.accounts, "retrieve").mockResolvedValue({
      id: "acct_1",
      details_submitted: false,
    } as never);
    const gateway = new StripePaymentGateway(
      { ...env, STRIPE_CONNECT_WEBHOOK_SECRET: "whsec_connect" },
      stripe,
    );
    const payload = JSON.stringify({
      id: "evt_account",
      type: "account.updated",
      livemode: false,
      account: "acct_1",
      data: { object: { id: "acct_1", details_submitted: false } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: "whsec_connect",
    });
    expect(await gateway.parseWebhook(Buffer.from(payload), signature)).toEqual(
      {
        id: "evt_account",
        type: "account_updated",
        accountId: "acct_1",
        ready: false,
      },
    );
  });
  it("expires checkout and reconciles already-expired or concurrently-completed sessions", async () => {
    const { gateway, sdk } = fixture();
    expect(await gateway.cancelCheckout("cs_1")).toEqual({ cancelled: true });
    expect(sdk.checkout.sessions.expire).toHaveBeenCalledWith("cs_1");
    sdk.checkout.sessions.expire.mockRejectedValue(
      new Error("expiration race"),
    );
    expect(await gateway.cancelCheckout("cs_1")).toEqual({ cancelled: true });
    sdk.checkout.sessions.retrieve.mockResolvedValueOnce({
      id: "cs_1",
      status: "complete",
    });
    expect(await gateway.cancelCheckout("cs_1")).toEqual({ cancelled: false });
    sdk.checkout.sessions.retrieve.mockResolvedValueOnce({
      id: "cs_1",
      status: "open",
    });
    await expect(gateway.cancelCheckout("cs_1")).rejects.toThrow(
      "expiration race",
    );
  });
  it("refreshes account readiness rather than trusting stale webhook snapshots", async () => {
    const { gateway, sdk } = fixture(
      { id: "acct_1", details_submitted: false },
      "account.updated",
    );
    expect(await gateway.parseWebhook(Buffer.from("{}"), "sig")).toMatchObject({
      type: "account_updated",
      ready: true,
    });
    expect(sdk.accounts.retrieve).toHaveBeenCalledWith("acct_1");
  });
  it("verifies actual raw signatures and rejects modified or live payloads", async () => {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const gateway = new StripePaymentGateway(env, stripe);
    const body = JSON.stringify({
      id: "evt_1",
      type: "unhandled",
      livemode: false,
      data: { object: {} },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: env.STRIPE_WEBHOOK_SECRET,
    });
    expect(
      (await gateway.parseWebhook(Buffer.from(body), signature)).type,
    ).toBe("ignored");
    await expect(
      gateway.parseWebhook(Buffer.from(body + " "), signature),
    ).rejects.toThrow("signature");
    const live = JSON.stringify({
      id: "evt_live",
      type: "unhandled",
      livemode: true,
      data: { object: {} },
    });
    await expect(
      gateway.parseWebhook(
        Buffer.from(live),
        stripe.webhooks.generateTestHeaderString({
          payload: live,
          secret: env.STRIPE_WEBHOOK_SECRET,
        }),
      ),
    ).rejects.toThrow("Live");
  });
});
