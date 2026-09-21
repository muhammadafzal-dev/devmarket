import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { PageHead } from "../ui";
export function Guide() {
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
