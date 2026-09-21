import Stripe from "stripe";

export type PaymentMode = "demo" | "stripe";
export interface CheckoutInput {
  orderId: string;
  title: string;
  totalCents: number;
  currency: string;
  buyerEmail: string;
  successUrl: string;
  cancelUrl: string;
  attempt: number;
}
export interface CheckoutResult {
  id: string;
  url: string | null;
}
export interface TransferInput {
  orderId: string;
  amountCents: number;
  currency: string;
  accountId: string;
  chargeId: string;
}
export interface RefundInput {
  orderId: string;
  paymentIntentId: string;
  amountCents: number;
}
export interface AccountResult {
  id: string;
  ready: boolean;
}
export interface PaymentEvent {
  id: string;
  type:
    | "paid"
    | "failed"
    | "refunded"
    | "refund_pending"
    | "disputed"
    | "account_updated"
    | "ignored";
  orderId?: string;
  amountCents?: number;
  currency?: string;
  checkoutId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  accountId?: string;
  ready?: boolean;
}
export interface PaymentGateway {
  readonly mode: PaymentMode;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  getCheckoutStatus(
    checkoutId: string,
  ): Promise<"open" | "expired" | "complete">;
  cancelCheckout(checkoutId: string): Promise<{ cancelled: boolean }>;
  createAccount(input: {
    userId: string;
    email: string;
    name: string;
  }): Promise<AccountResult>;
  createOnboardingLink(input: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }>;
  getAccount(accountId: string): Promise<AccountResult>;
  transfer(input: TransferInput): Promise<{ id: string }>;
  refund(
    input: RefundInput,
  ): Promise<{ id: string; status: "succeeded" | "pending" | "failed" }>;
  parseWebhook(body: Buffer, signature: string): Promise<PaymentEvent>;
}
type Environment = Record<string, string | undefined>;
const ref = (
  value: string | { id: string } | null | undefined,
): string | undefined => (typeof value === "string" ? value : value?.id);
function money(amount: number, currency = "usd"): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || currency !== "usd")
    throw new Error("Payments require positive integer USD cents");
}
function accountResult(account: Stripe.Account): AccountResult {
  return {
    id: account.id,
    ready:
      account.details_submitted === true &&
      account.payouts_enabled === true &&
      account.capabilities?.transfers === "active" &&
      !account.requirements?.disabled_reason &&
      (account.requirements?.currently_due?.length ?? 0) === 0 &&
      (account.requirements?.past_due?.length ?? 0) === 0,
  };
}
export class DemoPaymentGateway implements PaymentGateway {
  readonly mode = "demo" as const;
  constructor(env: Environment = {}) {
    if (env.NODE_ENV === "production")
      throw new Error("Demo payments are disabled in production");
  }
  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    money(i.totalCents, i.currency);
    return { id: `demo_checkout_${i.orderId}_${i.attempt}`, url: null };
  }
  async getCheckoutStatus(_checkoutId: string): Promise<"open"> {
    return "open";
  }
  async cancelCheckout(_checkoutId: string): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }
  async createAccount(i: {
    userId: string;
    email: string;
    name: string;
  }): Promise<AccountResult> {
    return { id: `demo_account_${i.userId}`, ready: true };
  }
  async createOnboardingLink(i: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    return { url: i.returnUrl };
  }
  async getAccount(id: string): Promise<AccountResult> {
    if (!id.startsWith("demo_account_")) throw new Error("Not a demo account");
    return { id, ready: true };
  }
  async transfer(i: TransferInput): Promise<{ id: string }> {
    money(i.amountCents, i.currency);
    return { id: `demo_transfer_${i.orderId}` };
  }
  async refund(i: RefundInput): Promise<{ id: string; status: "succeeded" }> {
    money(i.amountCents);
    return { id: `demo_refund_${i.orderId}`, status: "succeeded" };
  }
  async parseWebhook(): Promise<PaymentEvent> {
    throw new Error("Demo mode does not accept Stripe webhooks");
  }
}
export class StripePaymentGateway implements PaymentGateway {
  readonly mode = "stripe" as const;
  private readonly sdk: Stripe;
  private readonly secrets: string[];
  constructor(
    private readonly env: Environment,
    sdk?: Stripe,
  ) {
    if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
      throw new Error(
        "This learning application requires a Stripe sandbox secret key",
      );
    this.secrets = [
      env.STRIPE_WEBHOOK_SECRET,
      env.STRIPE_CONNECT_WEBHOOK_SECRET,
    ].filter((s): s is string => Boolean(s));
    if (!this.secrets.length)
      throw new Error("STRIPE_WEBHOOK_SECRET is required in Stripe mode");
    this.sdk =
      sdk ?? new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
  }
  async createCheckout(i: CheckoutInput): Promise<CheckoutResult> {
    money(i.totalCents, i.currency);
    if (!Number.isSafeInteger(i.attempt) || i.attempt < 0)
      throw new Error("Invalid checkout attempt");
    const session = await this.sdk.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: i.buyerEmail,
        client_reference_id: i.orderId,
        metadata: { orderId: i.orderId },
        payment_intent_data: {
          metadata: { orderId: i.orderId },
          transfer_group: `order:${i.orderId}`,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: i.currency,
              unit_amount: i.totalCents,
              product_data: { name: i.title },
            },
          },
        ],
        success_url: i.successUrl,
        cancel_url: i.cancelUrl,
      },
      { idempotencyKey: `checkout:${i.orderId}:${i.attempt}` },
    );
    return { id: session.id, url: session.url };
  }
  async getCheckoutStatus(
    checkoutId: string,
  ): Promise<"open" | "expired" | "complete"> {
    const session = await this.sdk.checkout.sessions.retrieve(checkoutId);
    if (!session.status) throw new Error("Checkout state unavailable");
    return session.status;
  }
  async cancelCheckout(checkoutId: string): Promise<{ cancelled: boolean }> {
    try {
      const session = await this.sdk.checkout.sessions.expire(checkoutId);
      return { cancelled: session.status === "expired" };
    } catch (error) {
      // Expiration can race with payment completion or another expiration request.
      // Read Stripe's authoritative state; an unresolved/open checkout is never safe to replace.
      const session = await this.sdk.checkout.sessions.retrieve(checkoutId);
      if (session.status === "expired") return { cancelled: true };
      if (session.status === "complete") return { cancelled: false };
      throw error;
    }
  }
  async createAccount(i: {
    userId: string;
    email: string;
    name: string;
  }): Promise<AccountResult> {
    const account = await this.sdk.accounts.create(
      {
        type: "express",
        country: this.env.STRIPE_ACCOUNT_COUNTRY ?? "US",
        email: i.email,
        business_profile: { name: i.name },
        capabilities: { transfers: { requested: true } },
        metadata: { userId: i.userId },
      },
      { idempotencyKey: `account:${i.userId}` },
    );
    return accountResult(account);
  }
  async createOnboardingLink(i: {
    accountId: string;
    returnUrl: string;
    refreshUrl: string;
  }): Promise<{ url: string }> {
    const link = await this.sdk.accountLinks.create({
      account: i.accountId,
      type: "account_onboarding",
      return_url: i.returnUrl,
      refresh_url: i.refreshUrl,
    });
    return { url: link.url };
  }
  async getAccount(id: string): Promise<AccountResult> {
    return accountResult(await this.sdk.accounts.retrieve(id));
  }
  async transfer(i: TransferInput): Promise<{ id: string }> {
    money(i.amountCents, i.currency);
    if (!i.chargeId.startsWith("ch_"))
      throw new Error("A successful source charge is required");
    const transfer = await this.sdk.transfers.create(
      {
        amount: i.amountCents,
        currency: i.currency,
        destination: i.accountId,
        source_transaction: i.chargeId,
        transfer_group: `order:${i.orderId}`,
        metadata: { orderId: i.orderId },
      },
      { idempotencyKey: `transfer:${i.orderId}` },
    );
    return { id: transfer.id };
  }
  async refund(
    i: RefundInput,
  ): Promise<{ id: string; status: "succeeded" | "pending" | "failed" }> {
    money(i.amountCents);
    const refund = await this.sdk.refunds.create(
      {
        payment_intent: i.paymentIntentId,
        amount: i.amountCents,
        metadata: { orderId: i.orderId },
      },
      { idempotencyKey: `refund:${i.orderId}` },
    );
    return {
      id: refund.id,
      status:
        refund.status === "succeeded"
          ? "succeeded"
          : refund.status === "failed" || refund.status === "canceled"
            ? "failed"
            : "pending",
    };
  }
  async parseWebhook(body: Buffer, signature: string): Promise<PaymentEvent> {
    if (!Buffer.isBuffer(body) || !signature)
      throw new Error("Raw body and Stripe signature required");
    let event: Stripe.Event | undefined;
    for (const secret of this.secrets) {
      try {
        event = this.sdk.webhooks.constructEvent(body, signature, secret);
        break;
      } catch {
        /* Try the separately configured Connect signing secret. */
      }
    }
    if (!event) throw new Error("Invalid Stripe webhook signature");
    if (event.livemode) throw new Error("Live Stripe events are not supported");
    const ignored: PaymentEvent = { id: event.id, type: "ignored" };
    if (event.type === "account.updated") {
      const account = await this.getAccount(
        (event.data.object as Stripe.Account).id,
      );
      return {
        id: event.id,
        type: "account_updated",
        accountId: account.id,
        ready: account.ready,
      };
    }
    // Charges belong to the platform, never to a connected account.
    if (event.account) return ignored;
    if (
      [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
      ].includes(event.type)
    ) {
      const s = event.data.object as Stripe.Checkout.Session;
      if (s.mode !== "payment") return ignored;
      const failed =
        event.type.endsWith("failed") || event.type.endsWith("expired");
      if (!failed && s.payment_status !== "paid") return ignored;
      if (failed)
        return {
          id: event.id,
          type: "failed",
          orderId: s.metadata?.orderId,
          checkoutId: s.id,
        };
      const piId = ref(s.payment_intent);
      if (!piId || s.amount_total === null || !s.currency) return ignored;
      const pi = await this.sdk.paymentIntents.retrieve(piId);
      if (!failed && (pi.status !== "succeeded" || !ref(pi.latest_charge)))
        return ignored;
      return {
        id: event.id,
        type: failed ? "failed" : "paid",
        orderId: s.metadata?.orderId,
        checkoutId: s.id,
        paymentIntentId: piId,
        chargeId: ref(pi.latest_charge),
        amountCents: s.amount_total,
        currency: s.currency,
      };
    }
    if (
      event.type === "payment_intent.succeeded" ||
      event.type === "payment_intent.payment_failed"
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      const sessions = await this.sdk.checkout.sessions.list({
        payment_intent: pi.id,
        limit: 1,
      });
      const session = sessions.data[0];
      if (
        !session ||
        (event.type === "payment_intent.succeeded" && !ref(pi.latest_charge))
      )
        return ignored;
      return {
        id: event.id,
        type: event.type === "payment_intent.succeeded" ? "paid" : "failed",
        orderId: pi.metadata.orderId,
        checkoutId: session.id,
        paymentIntentId: pi.id,
        chargeId: ref(pi.latest_charge),
        amountCents:
          event.type === "payment_intent.succeeded"
            ? pi.amount_received
            : pi.amount,
        currency: pi.currency,
      };
    }
    if (
      ["refund.created", "refund.updated", "charge.refund.updated"].includes(
        event.type,
      )
    ) {
      const r = event.data.object as Stripe.Refund;
      if (r.status === "failed" || r.status === "canceled") return ignored;
      const chargeId = ref(r.charge);
      const charge = chargeId
        ? await this.sdk.charges.retrieve(chargeId)
        : undefined;
      return {
        id: event.id,
        type: r.status === "succeeded" ? "refunded" : "refund_pending",
        orderId: r.metadata?.orderId ?? charge?.metadata?.orderId,
        amountCents: r.amount,
        currency: r.currency,
        paymentIntentId: ref(r.payment_intent),
        chargeId,
      };
    }
    if (event.type === "charge.refunded") {
      const c = event.data.object as Stripe.Charge;
      return {
        id: event.id,
        type: "refunded",
        orderId: c.metadata.orderId,
        amountCents: c.amount_refunded,
        currency: c.currency,
        chargeId: c.id,
        paymentIntentId: ref(c.payment_intent),
      };
    }
    if (event.type.startsWith("charge.dispute.")) {
      const d = event.data.object as Stripe.Dispute;
      const chargeId = ref(d.charge);
      if (!chargeId) return ignored;
      const charge = await this.sdk.charges.retrieve(chargeId);
      // Closed disputes stay frozen for manual reconciliation; never automatically release funds.
      return {
        id: event.id,
        type: "disputed",
        orderId: charge.metadata.orderId,
        amountCents: d.amount,
        currency: d.currency,
        chargeId,
        paymentIntentId: ref(charge.payment_intent),
      };
    }
    return ignored;
  }
}
export function createPaymentGateway(env: Environment): PaymentGateway {
  const mode = env.PAYMENT_MODE ?? "demo";
  if (mode === "demo") return new DemoPaymentGateway(env);
  if (mode === "stripe") return new StripePaymentGateway(env);
  throw new Error("PAYMENT_MODE must be demo or stripe");
}
