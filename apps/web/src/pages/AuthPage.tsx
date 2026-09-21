import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context";
import { ErrorBox, Field, PasswordField } from "../ui";
export function AuthPage({ register = false }: { register?: boolean }) {
  const { refresh, mode } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.target as HTMLFormElement);
    try {
      await api(
        "/auth/" + (register ? "register" : "login"),
        register
          ? { name: f.get("name"), email, password, role: f.get("role") }
          : { email, password },
      );
      await refresh();
      nav(register ? "/account" : "/dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-layout">
      <section className="auth-message">
        <span className="eyebrow">A GOOD PLACE TO BUILD</span>
        <h1>
          {register
            ? "Your next great collaboration starts here."
            : "Welcome back to good work."}
        </h1>
        <p>
          A little expertise. A clear agreement.
          <br />
          Something you’re proud to ship.
        </p>
        <span className="auth-star">✳</span>
      </section>
      <section className="panel auth-panel">
        <h2>{register ? "Create your account" : "Make yourself at home."}</h2>
        <p className="muted">
          {register
            ? "Join as a client or independent developer."
            : "Sign in to your DevMarket workspace."}
        </p>
        <form onSubmit={submit}>
          {register && (
            <Field label="Your name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <PasswordField
            label="Password"
            required
            minLength={register ? 10 : 1}
            autoComplete={register ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {register && (
            <>
              <small className="muted">Use at least 10 characters.</small>
              <Field label="I’m here to">
                <select
                  name="role"
                  defaultValue={
                    params.get("role") === "developer" ? "DEVELOPER" : "CLIENT"
                  }
                >
                  <option value="CLIENT">Hire a developer</option>
                  <option value="DEVELOPER">Offer my development skills</option>
                </select>
              </Field>
            </>
          )}
          <ErrorBox error={error} />
          <button className="button dark full" disabled={busy}>
            {busy ? "One moment…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="auth-links">
          {!register && <Link to="/forgot-password">Forgot password?</Link>}
          <Link to={register ? "/login" : "/register"}>
            {register
              ? "Already a member? Sign in"
              : "New here? Create an account"}
          </Link>
        </div>
        {!register && mode === "demo" && (
          <div className="demo-accounts">
            <span className="eyebrow">TAKE IT FOR A SPIN</span>
            <p>Fill a seeded demo account, then sign in.</p>
            <div className="button-row">
              {["buyer", "developer", "admin"].map((role) => (
                <button
                  key={role}
                  className="button outline small"
                  onClick={() => {
                    setEmail(role + "@devmarket.local");
                    setPassword("DemoPass123!");
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
export function TokenPage({ kind }: { kind: "forgot" | "reset" | "verify" }) {
  const [params] = useSearchParams();
  const { refresh, mode } = useAuth();
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="panel narrow">
      <span className="eyebrow">ACCOUNT ACCESS</span>
      <h1>
        {kind === "forgot"
          ? "A fresh start."
          : kind === "reset"
            ? "Choose a new password."
            : "Verify your email."}
      </h1>
      {success ? (
        <div className="notice success">
          {kind === "forgot"
            ? "If that account exists, a reset link has been sent."
            : kind === "reset"
              ? "Password updated. Sign in with your new password."
              : "Email verified. You’re ready to start."}
          <p>
            <Link to={kind === "verify" ? "/dashboard" : "/login"}>
              Continue →
            </Link>
          </p>
          {kind === "forgot" && mode === "demo" && (
            <Link to="/mailbox">Open local mailbox →</Link>
          )}
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api(
                "/auth/" +
                  (kind === "forgot"
                    ? "forgot-password"
                    : kind === "reset"
                      ? "reset-password"
                      : "verify-email"),
                kind === "forgot"
                  ? { email: f.get("email") }
                  : kind === "reset"
                    ? {
                        token: params.get("token"),
                        password: f.get("password"),
                      }
                    : { token: params.get("token") },
              );
              await refresh();
              setSuccess(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {kind === "forgot" ? (
            <Field label="Email address">
              <input name="email" type="email" required />
            </Field>
          ) : kind === "reset" ? (
            <PasswordField
              label="New password (at least 10 characters)"
              name="password"
              minLength={10}
              required
              autoComplete="new-password"
            />
          ) : (
            <p>
              Confirm your email address to unlock purchases and publishing.
            </p>
          )}
          <ErrorBox error={error} />
          <button
            className="button dark"
            disabled={busy || (kind !== "forgot" && !params.get("token"))}
          >
            {busy
              ? "Working…"
              : kind === "forgot"
                ? "Send reset link"
                : kind === "reset"
                  ? "Update password"
                  : "Verify email"}
          </button>
          {kind !== "forgot" && !params.get("token") && (
            <p className="error-text">
              The link is missing its token. Request a fresh email.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
