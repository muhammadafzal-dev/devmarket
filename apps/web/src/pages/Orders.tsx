import { useState } from "react";
import { Order, label } from "../api";
import { useData } from "../hooks";
import { ErrorBox, Loading, OrderList, PageHead } from "../ui";
export function OrdersPage() {
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
