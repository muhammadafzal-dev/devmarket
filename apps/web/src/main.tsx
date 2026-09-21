import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  FormEvent,
  ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowUpRight,
  ArrowRight,
  Code2,
  Layers,
  Terminal,
  Check,
  Clock,
  Search,
  ShieldCheck,
  Menu,
  X,
  Plus,
  Mail,
  RefreshCw,
  Wallet,
  Briefcase,
} from "lucide-react";
import { api, User, Service, Order, money, label } from "./api";
import "./style.css";
const Auth = createContext<{
  user: User | null;
  refresh: () => Promise<void>;
  mode: string;
}>({ user: null, refresh: async () => {}, mode: "unknown" });
const useAuth = () => useContext(Auth);
function useData<T>(path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api<T>(path));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<T>(path)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error, loading, reload };
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div role="alert" className="notice error">
      {error}
    </div>
  ) : null;
}
function Loading() {
  return (
    <div className="empty" role="status">
      <RefreshCw className="spin" size={20} /> Loading your workspace…
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={"status " + value.toLowerCase()}>{label(value)}</span>
  );
}
function Field({
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
function PageHead({
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
function App() {
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
const categories = [
  "All services",
  "Frontend",
  "Backend",
  "Full stack",
  "Design",
  "DevOps",
];
function Catalog() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All services");
  const { data, error, loading } = useData<{ services: Service[] }>(
    "/services?search=" +
      encodeURIComponent(search) +
      "&category=" +
      encodeURIComponent(category === "All services" ? "" : category),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-star">✳</span> BIG IDEAS. INDEPENDENT TALENT.
          </span>
          <h1>
            Less backlog.
            <br />
            More <em>built.</em>
          </h1>
          <p>
            Find a developer who gets it. Clear scope, upfront pricing,
            <br className="desktop" /> and payment released when you love the
            work.
          </p>
          <a href="#services" className="button dark">
            Find your next collaborator <ArrowUpRight size={18} />
          </a>
          <div className="hero-proof">
            <ShieldCheck size={17} />
            <span>Your project. Your approval. Your call.</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-label">
            FROM “WHAT IF”
            <br />
            TO “IT’S LIVE.”
          </div>
          <div className="code-card">
            <div className="code-top">
              <i />
              <i />
              <i />
              <span>something-great.tsx</span>
            </div>
            <div className="code-lines">
              <span className="code-muted">01 &nbsp; // make it happen</span>
              <br />
              02 &nbsp; <span className="code-pink">const</span> yourNextIdea ={" "}
              {"{"}
              <br />
              03 &nbsp; &nbsp; ambition:{" "}
              <span className="code-green">'big'</span>,<br />
              04 &nbsp; &nbsp; talent:{" "}
              <span className="code-green">'independent'</span>,<br />
              05 &nbsp; &nbsp; possibilities:{" "}
              <span className="code-pink">Infinity</span>
              <br />
              06 &nbsp; {"}"};<br />
              <br />
              <span className="code-muted">07 &nbsp; </span>{" "}
              <span className="code-green">ship</span>(yourNextIdea);
            </div>
          </div>
          <div className="shipped">
            <span>
              <Check size={19} />
            </span>
            <div>
              Good work. Delivered.<small>Made possible by people.</small>
            </div>
            <ArrowUpRight size={18} />
          </div>
          <span className="art-star">✳</span>
        </div>
      </section>
      <section className="value-strip">
        <span>
          <Code2 size={19} /> Real developers, clear deliverables
        </span>
        <span>
          <Wallet size={19} /> Fixed price. No surprises.
        </span>
        <span>
          <Check size={19} /> You approve. They get paid.
        </span>
      </section>
      <section id="services" className="catalog">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A LITTLE EXPERTISE GOES A LONG WAY</span>
            <h2>Find your missing piece.</h2>
          </div>
          <span className="muted">Small projects. Meaningful progress.</span>
        </div>
        <div className="catalog-tools">
          <div className="tabs" aria-label="Service categories">
            {categories.map((c) => (
              <button
                key={c}
                className={category === c ? "selected" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Search services"
              placeholder="Try “landing page”"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <ErrorBox error={error} />
        {loading ? (
          <Loading />
        ) : data?.services.length ? (
          <div className="service-grid">
            {data.services.map((s, i) => (
              <ServiceCard key={s.id} service={s} index={i} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <Search />
            <h3>No services found.</h3>
            <p>Try another keyword or category.</p>
            <button
              className="button outline"
              onClick={() => {
                setSearch("");
                setCategory("All services");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
      <section className="bottom-banner">
        <span className="big-star">✳</span>
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h2>
            Good at what you do?
            <br />
            There’s a project for that.
          </h2>
        </div>
        <Link to="/register?role=developer" className="button dark">
          Start selling your skills <ArrowUpRight size={18} />
        </Link>
      </section>
    </>
  );
}
function ServiceCard({
  service: s,
  index,
}: {
  service: Service;
  index: number;
}) {
  const icons = [
    <Code2 size={46} />,
    <Layers size={46} />,
    <Terminal size={46} />,
  ];
  return (
    <Link className="service-card" to={"/services/" + s.id}>
      <div className={"service-art art-" + (index % 4)}>
        <span className="art-category">{s.category}</span>
        <div className="service-glyph">
          {icons[index % 3]}
          <span>
            {index % 3 === 0 ? "</>" : index % 3 === 1 ? "[ build ]" : "~/ship"}
          </span>
        </div>
        <span className="card-arrow">
          <ArrowUpRight size={21} />
        </span>
      </div>
      <div className="service-body">
        <div className="seller">
          <span className="mini-avatar">{s.seller.name.slice(0, 1)}</span>
          {s.seller.name}
          <span className="seller-check">
            <Check size={11} />
          </span>
        </div>
        <h3>{s.title}</h3>
        <p>{s.description}</p>
        <div className="service-bottom">
          <span>
            <Clock size={14} />
            {s.deliveryDays}-day delivery
          </span>
          <strong>
            {money(s.priceCents)}
            <small> / project</small>
          </strong>
        </div>
      </div>
    </Link>
  );
}
function ServiceDetail() {
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
function AuthPage({ register = false }: { register?: boolean }) {
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
          <Field label="Password">
            <input
              type="password"
              required
              minLength={register ? 10 : 1}
              autoComplete={register ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
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
function TokenPage({ kind }: { kind: "forgot" | "reset" | "verify" }) {
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
            <Field label="New password (at least 10 characters)">
              <input
                name="password"
                type="password"
                minLength={10}
                required
                autoComplete="new-password"
              />
            </Field>
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
function OrderList({ orders }: { orders: Order[] }) {
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
function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading } = useData<{
    stats: {
      spentCents: number;
      earnedCents: number;
      activeOrders: number;
      completedOrders: number;
    };
    orders: Order[];
  }>("/dashboard");
  return (
    <>
      <PageHead
        eyebrow="YOUR WORKSPACE"
        title={"Good to see you, " + user!.name.split(" ")[0] + "."}
      >
        <Link to="/" className="button dark">
          Find a service <ArrowUpRight size={16} />
        </Link>
      </PageHead>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats">
              <Stat label="Active projects" value={data.stats.activeOrders} />
              <Stat
                label="Completed projects"
                value={data.stats.completedOrders}
              />
              <Stat label="Total spent" value={money(data.stats.spentCents)} />
              <Stat
                label="Earnings transferred"
                value={money(data.stats.earnedCents)}
              />
            </div>
            <div className="section-heading">
              <h2>The work in motion.</h2>
              <Link to="/orders">View all orders →</Link>
            </div>
            <OrderList orders={data.orders} />
          </>
        )
      )}
    </>
  );
}
function Stat({
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
function OrdersPage() {
  const { data, error, loading } = useData<{ orders: Order[] }>("/orders");
  const [filter, setFilter] = useState("ALL");
  return (
    <>
      <PageHead
        eyebrow="PROJECT HISTORY"
        title="Every project, in one place."
      />
      <div className="tabs space-bottom">
        {[
          "ALL",
          "AWAITING_PAYMENT",
          "PAID",
          "IN_PROGRESS",
          "DELIVERED",
          "COMPLETED",
          "CANCELLED",
        ].map((s) => (
          <button
            className={filter === s ? "selected" : ""}
            key={s}
            onClick={() => setFilter(s)}
          >
            {label(s)}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <OrderList
            orders={data.orders.filter(
              (o) => filter === "ALL" || o.status === filter,
            )}
          />
        )
      )}
    </>
  );
}
function OrderDetail() {
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
function Account() {
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
function Studio() {
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
function Admin() {
  const { data, error, loading } = useData<{
    stats: {
      users: number;
      orders: number;
      volumeCents: number;
      feesCents: number;
    };
    orders: Order[];
  }>("/admin/overview");
  return (
    <>
      <PageHead
        eyebrow="ADMINISTRATION"
        title="A clear view of the marketplace."
      />
      <div className="notice">
        Review an order for its audit timeline, payment status, disputes, and
        refund controls. Transfers already released require manual
        reconciliation.
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats">
              <Stat label="Registered users" value={data.stats.users} />
              <Stat label="Total orders" value={data.stats.orders} />
              <Stat
                label="Payment volume"
                value={money(data.stats.volumeCents)}
              />
              <Stat label="Platform fees" value={money(data.stats.feesCents)} />
            </div>
            <h2>All marketplace orders</h2>
            <OrderList orders={data.orders} />
          </>
        )
      )}
    </>
  );
}
function Mailbox() {
  const { data, error, loading, reload } = useData<{
    messages: {
      id: string;
      to: string;
      subject: string;
      url: string;
      createdAt: string;
    }[];
  }>("/dev/mailbox");
  return (
    <>
      <PageHead
        eyebrow="LOCAL DEVELOPMENT ONLY"
        title="You’ve got (test) mail."
      >
        <button className="button outline" onClick={() => reload()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </PageHead>
      <div className="notice">
        This development inbox contains verification and reset links. It is
        disabled in production.
      </div>
      <ErrorBox error={error} />
      {loading ? (
        <Loading />
      ) : data?.messages.length ? (
        <div className="mail-list">
          {data.messages.map((m) => (
            <article className="panel" key={m.id}>
              <Mail size={22} />
              <h3>{m.subject}</h3>
              <p>To: {m.to}</p>
              <small>{new Date(m.createdAt).toLocaleString()}</small>
              <p>
                <Link
                  className="button outline small"
                  to={
                    new URL(m.url, window.location.origin).pathname +
                    new URL(m.url, window.location.origin).search
                  }
                >
                  Open email link <ArrowUpRight size={15} />
                </Link>
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">
          <Mail />
          <h3>All quiet here.</h3>
          <p>Register or request a password reset to receive a local email.</p>
        </div>
      )}
    </>
  );
}
function Guide() {
  return (
    <div className="guide">
      <PageHead eyebrow="THE PROCESS" title="Good work. Clear agreements." />
      <p className="lede">
        A marketplace built around one simple idea: agree on the work, make it
        happen, then approve the result.
      </p>
      <div className="process-list">
        <div>
          <span>01</span>
          <p>
            <strong>Find your developer</strong>Browse a fixed-price service,
            share requirements, and create an order. The price and platform
            commission are captured when you order.
          </p>
        </div>
        <div>
          <span>02</span>
          <p>
            <strong>Fund the project</strong>Complete checkout to pay the
            platform. In demo mode, explicitly simulate a success or failure. No
            real money moves.
          </p>
        </div>
        <div>
          <span>03</span>
          <p>
            <strong>Build, deliver, refine</strong>The developer starts work and
            submits a delivery with notes and an optional HTTPS link. Request
            revisions if needed.
          </p>
        </div>
        <div>
          <span>04</span>
          <p>
            <strong>Approve and release</strong>Approve the delivery to transfer
            the developer’s 90% share to their connected Stripe account. The
            platform keeps 10% before processing costs. A bank payout is a
            separate step.
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>Try the entire journey.</h2>
        <p>
          Sign in as the demo buyer to order and pay. Sign out, then sign in as
          the developer to start and deliver. Return as the buyer to approve and
          release.
        </p>
        <p>
          Use the account shortcuts on the sign-in screen. All three seeded
          accounts use <code>DemoPass123!</code>.
        </p>
        <Link to="/login" className="button dark">
          Open your workspace <ArrowUpRight size={16} />
        </Link>
      </section>
      <p className="caption">
        Stripe Connect supports separate charges and transfers; this is not an
        escrow service. This application is a local learning environment, with
        real Stripe sandbox integration available once configured.
      </p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
