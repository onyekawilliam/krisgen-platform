import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("");

  function load() {
    api.get("/orders/admin/all", { params: filter ? { status: filter } : {} }).then((res) => setOrders(res.data.data));
  }
  useEffect(load, [filter]);

  async function updateStatus(id, status) {
    await api.patch(`/orders/admin/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Orders</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending_payment", "paid", "processing", "delivered", "cancelled", "refunded"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Order</th>
            <th className="py-2.5">Buyer</th>
            <th className="py-2.5">Products</th>
            <th className="py-2.5">Amount</th>
            <th className="py-2.5">Status</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink font-mono">{o.orderNumber}</td>
              <td className="py-2.5 text-ink-dim">{o.buyer?.name}</td>
              <td className="py-2.5 text-ink-dim">
                {o.items?.map((item, index) => (
                  <div key={index}>
                    {item.product?.brand} {item.product?.model} × {item.quantity}
                  </div>
                ))}
              </td>
              <td className="py-2.5 text-ink-dim">{naira(o.totalAmount)}</td>
              <td className="py-2.5 text-ink-dim capitalize">{o.status.replace("_", " ")}</td>
              <td className="py-2.5">
                {o.status === "paid" && (
                  <button onClick={() => updateStatus(o._id, "processing")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-gold">Mark processing</button>
                )}
                {o.status === "processing" && (
                  <button onClick={() => updateStatus(o._id, "delivered")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-teal">Mark delivered</button>
                )}
                {["paid", "processing"].includes(o.status) && (
                  <button onClick={() => updateStatus(o._id, "cancelled")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Cancel</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
