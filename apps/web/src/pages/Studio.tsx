import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Code2, Plus, Wallet, X } from "lucide-react";
import { api, Service, money } from "../api";
import { useData } from "../hooks";
import { useAuth } from "../context";
import { categories } from "../constants";
import { ErrorBox, Field, Loading, PageHead, Status } from "../ui";
export function Studio() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useData<{ services: Service[] }>(
    "/services?mine=true",
  );
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const [issue, setIssue] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="SELLER STUDIO"
        title="Your expertise, out in the world."
      >
        <button
          className="button dark"
          onClick={() => {
            setEditing(null);
            setIssue("");
          }}
        >
          <Plus size={17} /> New service
        </button>
      </PageHead>
      {!user!.connectReady && (
        <div className="notice">
          Connect your account before publishing.{" "}
          <Link to="/account">Set up your account →</Link>
        </div>
      )}
      <ErrorBox error={error} />
      {editing !== undefined && (
        <section className="panel space-bottom">
          <div className="section-heading">
            <h2>
              {editing ? "Edit your service" : "Make your skills discoverable."}
            </h2>
            <button
              className="icon-button"
              aria-label="Close editor"
              onClick={() => setEditing(undefined)}
            >
              <X />
            </button>
          </div>
          <form
            key={editing?.id || "new"}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setIssue("");
              try {
                await api(
                  "/services" + (editing ? "/" + editing.id : ""),
                  {
                    title: f.get("title"),
                    description: f.get("description"),
                    category: f.get("category"),
                    priceCents: Math.round(Number(f.get("price")) * 100),
                    deliveryDays: Number(f.get("days")),
                    published: f.get("published") === "on",
                  },
                  editing ? "PATCH" : "POST",
                );
                setEditing(undefined);
                await reload();
              } catch (e) {
                setIssue((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Service title">
              <input
                name="title"
                required
                minLength={5}
                maxLength={160}
                defaultValue={editing?.title}
                placeholder="I will build a thoughtful landing page"
              />
            </Field>
            <Field label="Description and deliverables">
              <textarea
                name="description"
                required
                minLength={20}
                maxLength={10000}
                rows={5}
                defaultValue={editing?.description}
              />
            </Field>
            <div className="three-cols">
              <Field label="Category">
                <select
                  name="category"
                  defaultValue={editing?.category || "Frontend"}
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fixed price (USD)">
                <input
                  name="price"
                  type="number"
                  required
                  min="5"
                  max="10000"
                  step="0.01"
                  defaultValue={editing ? editing.priceCents / 100 : 100}
                />
              </Field>
              <Field label="Delivery time (days)">
                <input
                  name="days"
                  type="number"
                  required
                  min="1"
                  max="90"
                  defaultValue={editing?.deliveryDays || 3}
                />
              </Field>
            </div>
            <label className="checkbox">
              <input
                name="published"
                type="checkbox"
                defaultChecked={editing?.published}
                disabled={!user!.connectReady || !user!.emailVerified}
              />{" "}
              Publish in the marketplace
            </label>
            <ErrorBox error={issue} />
            <button className="button dark" disabled={busy}>
              {busy ? "Saving…" : "Save service"}
              <Check size={16} />
            </button>
          </form>
        </section>
      )}
      {loading ? (
        <Loading />
      ) : data?.services.length ? (
        <div className="order-list">
          {data.services.map((s) => (
            <div key={s.id} className="order-row">
              <span className="order-icon">
                <Code2 size={22} />
              </span>
              <div className="order-title">
                <strong>{s.title}</strong>
                <small>
                  {s.category} · {s.deliveryDays}-day delivery
                </small>
              </div>
              <Status value={s.published ? "PUBLISHED" : "DRAFT"} />
              <strong>{money(s.priceCents)}</strong>
              <button
                className="button outline small"
                onClick={() => {
                  setEditing(s);
                  setIssue("");
                }}
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Code2 />
          <h3>Your skills belong here.</h3>
          <p>Create your first service to get started.</p>
        </div>
      )}
      <section className="bottom-banner compact">
        <Wallet size={36} />
        <div>
          <h2>Follow your earnings.</h2>
          <p>
            See transferred earnings and project activity in your workspace.
          </p>
        </div>
        <Link to="/dashboard" className="button dark">
          View workspace <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
