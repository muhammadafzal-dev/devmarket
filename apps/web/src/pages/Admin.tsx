import { Order, money } from "../api";
import { useData } from "../hooks";
import { ErrorBox, Loading, OrderList, PageHead, Stat } from "../ui";
export function Admin() {
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
