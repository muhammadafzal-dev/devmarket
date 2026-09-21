import { InputHTMLAttributes, ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Briefcase,
  Code2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Order, money, label } from "./api";
export function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="notice error">
      {error}
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div className="empty" role="status">
      <RefreshCw className="spin" size={20} /> Loading your workspace…
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value.toLowerCase()}>{label(value)}</span>
  );
}
export function Field({
  label: caption,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children}
    </label>
  );
}
export function PasswordField({
  label: caption,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <Field label={caption}>
      <div className="password-wrap">
        <input {...props} type={show ? "text" : "password"} />
        <button
          type="button"
          className="password-toggle"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </Field>
  );
}
export function PageHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
export function Stat({
  label: caption,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat">
      <span>{caption}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function OrderList({ orders }: { orders: Order[] }) {
  if (!orders.length)
    return (
      <div className="empty">
        <Briefcase />
        <h3>Your next project starts here.</h3>
        <p>
          No orders yet. Find the right developer and make something happen.
        </p>
        <Link className="button outline" to="/">
          Explore services
        </Link>
      </div>
    );
  return (
    <div className="order-list">
      {orders.map((o) => (
        <Link key={o.id} to={"/orders/" + o.id} className="order-row">
          <span className="order-icon">
            <Code2 size={22} />
          </span>
          <div className="order-title">
            <strong>{o.title}</strong>
            <small>
              {o.buyer.name} → {o.seller.name} ·{" "}
              {new Date(o.createdAt).toLocaleDateString()}
            </small>
          </div>
          <Status value={o.status} />
          <strong>{money(o.totalCents)}</strong>
          <ArrowUpRight size={18} />
        </Link>
      ))}
    </div>
  );
}
