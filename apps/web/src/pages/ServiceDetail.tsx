import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { api, Order, Service, money } from "../api";
import { useData } from "../hooks";
import { useAuth } from "../context";
import { ErrorBox, Field, Loading } from "../ui";
export function ServiceDetail() {
  const { id } = useParams();
  const { data, error, loading } = useData<{ service: Service }>(
    "/services/" + id,
  );
  const { user } = useAuth();
  const nav = useNavigate();
  const [requirements, setRequirements] = useState("");
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState("");
  if (loading) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  const s = data.service;
  return (
    <>
      <Link to="/" className="back-link">
        ← All services
      </Link>
      <div className="detail-grid">
        <article>
          <span className="eyebrow">{s.category} / FIXED-PRICE EXPERTISE</span>
          <h1>{s.title}</h1>
          <div className="seller">
            <span className="avatar">{s.seller.name[0]}</span>
            <strong>{s.seller.name}</strong>
            <ShieldCheck size={17} />
          </div>
          <div className="prose">
            <h2>The work, explained.</h2>
            <p className="preserve">{s.description}</p>
          </div>
          <div className="process-list">
            <div>
              <span>01</span>
              <p>
                <strong>Share the brief</strong>Tell your developer what a great
                result looks like.
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>Watch it take shape</strong>Track progress and request a
                revision if needed.
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>Approve the work</strong>Release their share when the
                delivery is ready.
              </p>
            </div>
          </div>
        </article>
        <aside className="panel order-panel">
          <span className="eyebrow">ONE PROJECT. CLEAR EXPECTATIONS.</span>
          <div className="price">{money(s.priceCents)}</div>
          <p>
            <Clock size={16} /> Delivered in {s.deliveryDays} days
          </p>
          <hr />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setIssue("");
              try {
                const d = await api<{ order: Order }>("/orders", {
                  serviceId: s.id,
                  requirements,
                });
                nav("/orders/" + d.order.id);
              } catch (e) {
                setIssue((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Your project requirements">
              <textarea
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                placeholder="Goals, context, references, and anything else your developer should know…"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </Field>
            <ErrorBox error={issue} />
            {!user ? (
              <Link className="button dark full" to="/login">
                Sign in to start <ArrowRight size={16} />
              </Link>
            ) : (
              <button
                className="button dark full"
                disabled={
                  busy || user.id === s.seller.id || !user.emailVerified
                }
              >
                {busy
                  ? "Creating order…"
                  : user.id === s.seller.id
                    ? "This is your service"
                    : "Continue to order"}
                <ArrowRight size={16} />
              </button>
            )}
          </form>
          <small className="muted">
            Payment is collected at checkout. The developer’s share transfers
            after your approval.
          </small>
        </aside>
      </div>
    </>
  );
}
