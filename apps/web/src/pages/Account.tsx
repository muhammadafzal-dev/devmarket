import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../context";
import { ErrorBox, PageHead, Status } from "../ui";
export function Account() {
  const { user, refresh, mode } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const connect = async (action: string) => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ url?: string; ready?: boolean }>(
        "/connect/" + action,
        {},
      );
      if (r.url) window.location.assign(r.url);
      else {
        await refresh();
        setNotice(
          action === "onboard"
            ? "Demo onboarding complete. Your connected account is ready."
            : r.ready
              ? "Your connected account is ready."
              : "Account requirements are still pending.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead eyebrow="YOUR ACCOUNT" title="The details behind the work." />
      <ErrorBox error={error} />
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      <div className="two-cols">
        <section className="panel">
          <span className="eyebrow">PROFILE</span>
          <h2>{user!.name}</h2>
          <p>{user!.email}</p>
          <Status value={user!.role} />
          <hr />
          <h3>Email verification</h3>
          <p>
            {user!.emailVerified
              ? "Your email is verified."
              : "Verify your email to buy services and publish your work."}
          </p>
          {!user!.emailVerified && (
            <button
              className="button outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("/auth/resend-verification", {});
                  setNotice(
                    "Verification email sent. In local development, open the dev mailbox.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend verification email
            </button>
          )}
          {
            <p>
              <Link to="/mailbox">Open local dev mailbox →</Link>
            </p>
          }
        </section>
        {user!.role === "DEVELOPER" && (
          <section className="panel connect-panel">
            <span className="eyebrow">STRIPE CONNECT</span>
            <h2>A home for your earnings.</h2>
            <p>
              Connect an account to publish services and receive your share when
              clients approve the work.
            </p>
            <Status
              value={user!.connectReady ? "READY" : "ONBOARDING_REQUIRED"}
            />
            <p className="caption">
              {mode === "demo"
                ? "Demo mode simulates a ready connected account. No Stripe setup is needed yet."
                : "Complete Stripe-hosted onboarding with test details. We check account capabilities before enabling payments."}
            </p>
            <div className="button-row">
              <button
                className="button dark"
                disabled={busy}
                onClick={() => connect("onboard")}
              >
                {user!.connectReady
                  ? "Open onboarding"
                  : mode === "demo"
                    ? "Simulate onboarding"
                    : "Set up connected account"}
                <ArrowUpRight size={15} />
              </button>
              <button
                className="button outline"
                disabled={busy}
                onClick={() => connect("refresh")}
              >
                <RefreshCw size={15} /> Refresh status
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
