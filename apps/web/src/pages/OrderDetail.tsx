import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { api, Order, money, label } from "../api";
import { useData } from "../hooks";
import { useAuth } from "../context";
import { ErrorBox, Field, Loading, PageHead, Status } from "../ui";
export function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useData<{ order: Order }>(
    "/orders/" + id,
  );
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("");
  const act = async (action: string, body: unknown = {}) => {
    setBusy(true);
    setIssue("");
    try {
      const r = await api<{ url?: string; demo?: boolean }>(
        "/orders/" + id + "/" + action,
        body,
      );
      if (action === "checkout") {
        if (r.demo) setCheckout(true);
        else if (r.url) window.location.assign(r.url);
      } else {
        setCheckout(false);
        setMessage("");
        await reload();
      }
    } catch (e) {
      setIssue((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  const o = data.order;
  const buyer = user!.id === o.buyer.id,
    seller = user!.id === o.seller.id,
    admin = user!.role === "ADMIN";
  const canRefund =
    o.paymentStatus === "PAID" &&
    o.transferStatus !== "TRANSFERRED" &&
    (admin || (buyer && o.status === "PAID"));
  return (
    <>
      <Link className="back-link" to="/orders">
        ← Your orders
      </Link>
      <PageHead
        eyebrow={"ORDER / " + o.id.slice(-8).toUpperCase()}
        title={o.title}
      >
        <Status value={o.status} />
      </PageHead>
      <ErrorBox error={issue || error} />
      <div className="detail-grid">
        <div>
          <section className="panel">
            <span className="eyebrow">THE BRIEF</span>
            <h2>A shared starting point.</h2>
            <p className="preserve">{o.requirements}</p>
            <div className="people">
              <span>
                Client <strong>{o.buyer.name}</strong>
              </span>
              <ArrowRight size={19} />
              <span>
                Developer <strong>{o.seller.name}</strong>
              </span>
            </div>
          </section>
          {o.deliveryMessage && (
            <section className="panel space-top">
              <span className="eyebrow">LATEST DELIVERY</span>
              <h2>Ready for your review.</h2>
              <p className="preserve">{o.deliveryMessage}</p>
              {o.deliveryUrl && /^https:\/\//.test(o.deliveryUrl) && (
                <a
                  href={o.deliveryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  Open delivered work <ArrowUpRight size={16} />
                </a>
              )}
            </section>
          )}
          {o.revisionNote && (
            <div className="notice space-top">
              <strong>Revision requested</strong>
              <p className="preserve">{o.revisionNote}</p>
            </div>
          )}
          <section className="panel space-top">
            <h2>Project timeline</h2>
            <div className="timeline">
              {o.events?.length ? (
                o.events.map((e) => (
                  <div key={e.id}>
                    <span className="timeline-dot" />
                    <strong>{label(e.action)}</strong>
                    <p>{e.message}</p>
                    <small>{new Date(e.createdAt).toLocaleString()}</small>
                  </div>
                ))
              ) : (
                <p className="muted">The project has just begun.</p>
              )}
            </div>
          </section>
        </div>
        <aside>
          <section className="panel">
            <span className="eyebrow">THE PAYMENT PICTURE</span>
            <div className="breakdown">
              <span>Project total</span>
              <strong>{money(o.totalCents)}</strong>
              <span>Platform commission</span>
              <strong>{money(o.feeCents)}</strong>
              <span>Developer’s share</span>
              <strong>{money(o.sellerCents)}</strong>
            </div>
            <hr />
            <div className="status-line">
              <span>Payment</span>
              <Status value={o.paymentStatus} />
            </div>
            <div className="status-line">
              <span>Transfer</span>
              <Status value={o.transferStatus} />
            </div>
            <p className="caption">
              {o.paymentMode === "demo"
                ? "Simulated payment · No real money moves."
                : "Stripe sandbox · Test payments only."}{" "}
              A transfer moves the developer’s share to their Stripe balance.
              Bank payout happens separately.
            </p>
          </section>
          <section className="panel space-top">
            <h3>Next step</h3>
            {buyer && o.status === "AWAITING_PAYMENT" && (
              <>
                <p>Fund this project to get the work started.</p>
                <button
                  className="button dark full"
                  disabled={busy || !user!.emailVerified}
                  onClick={() => act("checkout")}
                >
                  Continue to checkout <ArrowRight size={16} />
                </button>
              </>
            )}
            {seller && o.status === "PAID" && (
              <>
                <p>Your client has paid. Ready to begin?</p>
                <button
                  className="button dark full"
                  disabled={busy}
                  onClick={() => act("start")}
                >
                  Start work <ArrowRight size={16} />
                </button>
              </>
            )}
            {seller && o.status === "IN_PROGRESS" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("deliver", { message, ...(url ? { url } : {}) });
                }}
              >
                <Field label="Delivery message">
                  <textarea
                    required
                    minLength={3}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What you built, how to review it, and any notes…"
                  />
                </Field>
                <Field label="Work URL (optional, HTTPS)">
                  <input
                    type="url"
                    pattern="https://.*"
                    placeholder="https://…"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </Field>
                <button className="button dark full" disabled={busy}>
                  Submit delivery <ArrowUpRight size={16} />
                </button>
              </form>
            )}
            {buyer && o.status === "DELIVERED" && (
              <>
                <p>
                  Review the delivery. Approving releases {money(o.sellerCents)}{" "}
                  to your developer.
                </p>
                <button
                  className="button dark full"
                  disabled={busy || o.paymentStatus !== "PAID"}
                  onClick={() => act("release")}
                >
                  Approve & release {money(o.sellerCents)}
                </button>
                <form
                  className="space-top"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("revise", { message });
                  }}
                >
                  <Field label="Or request a revision">
                    <textarea
                      required
                      minLength={3}
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe the changes you need…"
                    />
                  </Field>
                  <button className="button outline full" disabled={busy}>
                    Request revision
                  </button>
                </form>
              </>
            )}
            {buyer &&
              o.status === "COMPLETED" &&
              o.transferStatus !== "TRANSFERRED" && (
                <>
                  <p>
                    Work approved. Your developer’s transfer is{" "}
                    {label(o.transferStatus)}.
                  </p>
                  <button
                    className="button dark full"
                    disabled={busy || o.paymentStatus !== "PAID"}
                    onClick={() => act("release")}
                  >
                    Retry transfer
                  </button>
                </>
              )}
            {o.status === "COMPLETED" && o.transferStatus === "TRANSFERRED" && (
              <p className="success-text">
                <Check size={18} /> Work approved and developer share
                transferred.
              </p>
            )}
            {o.status === "CANCELLED" && <p>This order is closed.</p>}
            {buyer && ["PAID", "IN_PROGRESS"].includes(o.status) && (
              <p>
                Your developer is{" "}
                {o.status === "PAID"
                  ? "getting ready to begin"
                  : "working on your project"}
                . Check back for a delivery.
              </p>
            )}
            {seller && o.status === "AWAITING_PAYMENT" && (
              <p>Waiting for your client to complete payment.</p>
            )}
            {seller && o.status === "DELIVERED" && (
              <p>Your delivery is with the client for review.</p>
            )}
            {o.paymentStatus === "DISPUTED" && (
              <div className="notice error">
                Payment is disputed. Release is frozen pending resolution.
              </div>
            )}
            {(((buyer || admin) && o.status === "AWAITING_PAYMENT") ||
              canRefund) && (
              <details className="space-top">
                <summary>
                  {canRefund ? "Refund this order" : "Cancel this order"}
                </summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act(canRefund ? "refund" : "cancel", { reason });
                  }}
                >
                  <Field label="Reason">
                    <textarea
                      required
                      minLength={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                  </Field>
                  <button className="button outline full" disabled={busy}>
                    Confirm {canRefund ? "refund" : "cancellation"}
                  </button>
                </form>
              </details>
            )}
            {busy && (
              <p role="status" className="muted">
                Updating your order…
              </p>
            )}
          </section>
        </aside>
      </div>
      {checkout && (
        <div className="modal-backdrop">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            className="panel modal"
          >
            <span className="eyebrow">DEMO CHECKOUT · NO REAL MONEY</span>
            <h2 id="checkout-title">Let’s fund your project.</h2>
            <p>{o.title}</p>
            <div className="price">{money(o.totalCents)}</div>
            <p>
              This simulates a successful payment to the platform. The developer
              is paid only after you approve their delivery.
            </p>
            <ErrorBox error={issue} />
            <button
              autoFocus
              className="button dark full"
              disabled={busy}
              onClick={() => act("demo-pay", { outcome: "success" })}
            >
              Simulate successful payment
            </button>
            <button
              className="button outline full space-top"
              disabled={busy}
              onClick={() => act("demo-pay", { outcome: "failure" })}
            >
              Simulate payment failure
            </button>
            <button
              className="text-button space-top"
              disabled={busy}
              onClick={() => setCheckout(false)}
            >
              Back to order
            </button>
          </section>
        </div>
      )}
    </>
  );
}
