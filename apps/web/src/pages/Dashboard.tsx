import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Order, money } from "../api";
import { useData } from "../hooks";
import { useAuth } from "../context";
import { ErrorBox, Loading, OrderList, PageHead, Stat } from "../ui";
export function Dashboard() {
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
