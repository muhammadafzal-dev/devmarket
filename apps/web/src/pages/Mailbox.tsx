import { Link } from "react-router-dom";
import { ArrowUpRight, Mail, RefreshCw } from "lucide-react";
import { useData } from "../hooks";
import { ErrorBox, Loading, PageHead } from "../ui";
export function Mailbox() {
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
