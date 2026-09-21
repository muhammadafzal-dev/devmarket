import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { api, User } from "./api";
import { Auth, useAuth } from "./context";
import { ErrorBox, Loading } from "./ui";
import { Catalog } from "./pages/Catalog";
import { ServiceDetail } from "./pages/ServiceDetail";
import { AuthPage, TokenPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { OrdersPage } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { Account } from "./pages/Account";
import { Studio } from "./pages/Studio";
import { Admin } from "./pages/Admin";
import { Mailbox } from "./pages/Mailbox";
import { Guide } from "./pages/Guide";
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState("unknown");
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const refresh = async () => {
    try {
      const d = await api<{ user: User }>("/auth/me");
      setUser(d.user);
    } catch {
      setUser(null);
    }
  };
  useEffect(() => {
    Promise.all([
      refresh(),
      api<{ paymentMode: string }>("/health")
        .then((d) => setMode(d.paymentMode))
        .catch(() => {}),
    ]).finally(() => setReady(true));
  }, []);
  return (
    <Auth.Provider value={{ user, refresh, mode }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="mode-bar">
        <span className="live-dot" />
        {mode === "demo"
          ? "THE PRACTICE STUDIO"
          : "STRIPE CONNECT LEARNING STUDIO"}
        <span className="bar-detail">
          {mode === "demo"
            ? "Demo payments. Real learning. No money moves."
            : mode === "stripe"
              ? "Stripe sandbox · Test payments only"
              : "Connecting to the local API…"}
        </span>
        <Link to="/guide">
          How it works <ArrowUpRight size={12} />
        </Link>
      </div>
      <header>
        <div className="nav-wrap">
          <Link to="/" className="brand">
            <span className="brand-mark">
              d<span>m</span>
            </span>
            devmarket<span className="brand-period">.</span>
          </Link>
          <button
            aria-label="Toggle navigation"
            className="icon-button mobile-toggle"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
          <nav className={open ? "open" : ""} onClick={() => setOpen(false)}>
            <NavLink to="/" end>
              Explore services
            </NavLink>
            {user && <NavLink to="/dashboard">Workspace</NavLink>}
            {user && <NavLink to="/orders">Orders</NavLink>}
            {user?.role === "DEVELOPER" && (
              <NavLink to="/studio">Seller studio</NavLink>
            )}
            {user?.role === "ADMIN" && <NavLink to="/admin">Admin</NavLink>}
          </nav>
          <div className="nav-account">
            {user ? (
              <>
                <Link className="avatar" title={user.name} to="/account">
                  {user.name.slice(0, 1)}
                </Link>
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      await api("/auth/logout", {});
                      await refresh();
                    } catch (e) {
                      setLogoutError((e as Error).message);
                    }
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-link">
                  Log in
                </Link>
                <Link className="button small dark" to="/register">
                  Get started <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main">
        <ErrorBox error={logoutError} />
        {!ready ? (
          <Loading />
        ) : (
          <Routes>
            <Route path="/" element={<Catalog />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            <Route path="/login" element={<AuthPage />} />
            <Route path="/register" element={<AuthPage register />} />
            <Route
              path="/forgot-password"
              element={<TokenPage kind="forgot" />}
            />
            <Route
              path="/reset-password"
              element={<TokenPage kind="reset" />}
            />
            <Route path="/verify-email" element={<TokenPage kind="verify" />} />
            <Route
              path="/dashboard"
              element={
                <Guard>
                  <Dashboard />
                </Guard>
              }
            />
            <Route
              path="/orders"
              element={
                <Guard>
                  <OrdersPage />
                </Guard>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <Guard>
                  <OrderDetail />
                </Guard>
              }
            />
            <Route
              path="/studio"
              element={
                <Guard role="DEVELOPER">
                  <Studio />
                </Guard>
              }
            />
            <Route
              path="/account"
              element={
                <Guard>
                  <Account />
                </Guard>
              }
            />
            <Route
              path="/admin"
              element={
                <Guard role="ADMIN">
                  <Admin />
                </Guard>
              }
            />
            <Route path="/mailbox" element={<Mailbox />} />
            <Route path="/guide" element={<Guide />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found.</h1>
                  <Link to="/" className="button dark">
                    Explore services
                  </Link>
                </div>
              }
            />
          </Routes>
        )}
      </main>
      <footer>
        <Link className="brand" to="/">
          devmarket.
        </Link>
        <span>Independent talent. Thoughtfully delivered.</span>
        <div>
          <Link to="/guide">The process</Link>
          <Link to="/mailbox">Dev mailbox</Link>
          <span>Built to learn ↗</span>
        </div>
      </footer>
    </Auth.Provider>
  );
}
function Guard({ children, role }: { children: ReactNode; role?: string }) {
  const { user } = useAuth();
  if (!user)
    return (
      <div className="empty">
        <h1>Your workspace awaits.</h1>
        <p>Sign in to manage your projects and payments.</p>
        <Link to="/login" className="button dark">
          Sign in <ArrowRight size={16} />
        </Link>
      </div>
    );
  if (role && user.role !== role)
    return (
      <div className="empty">
        <h1>This space is for {role.toLowerCase()} accounts.</h1>
        <Link to="/dashboard">Back to your workspace</Link>
      </div>
    );
  return (
    <>
      {!user.emailVerified && (
        <div className="notice">
          Verify your email before purchasing or publishing.{" "}
          <Link to="/account">Manage verification</Link>
        </div>
      )}
      {children}
    </>
  );
}
