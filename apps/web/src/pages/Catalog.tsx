import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Clock,
  Code2,
  Layers,
  Search,
  ShieldCheck,
  Terminal,
  Wallet,
} from "lucide-react";
import { Service, money } from "../api";
import { useData } from "../hooks";
import { categories } from "../constants";
import { ErrorBox, Loading } from "../ui";
export function Catalog() {
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
