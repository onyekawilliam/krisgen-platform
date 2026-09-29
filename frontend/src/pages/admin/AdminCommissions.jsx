import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function AdminCommissions() {
  const [commissions, setCommissions] = useState([]);
  const [filter, setFilter] = useState("");

  function load() {
    api.get("/commissions/admin/all", { params: filter ? { status: filter } : {} }).then((res) => setCommissions(res.data.data));
  }
  useEffect(load, [filter]);

  async function updateStatus(id, status) {
    await api.patch(`/commissions/admin/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Commissions</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "approved", "paid", "cancelled", "reversed"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Beneficiary</th>
            <th className="py-2.5">Type</th>
            <th className="py-2.5">Product</th>
            <th className="py-2.5">Profit</th>
            <th className="py-2.5">Rate</th>
            <th className="py-2.5">Amount</th>
            <th className="py-2.5">Status</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {commissions.map((c) => (
            <tr key={c._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink">{c.beneficiary?.name}</td>
              <td className="py-2.5 text-ink-dim capitalize">{c.type}</td>
              <td className="py-2.5 text-ink-dim">{c.product?.name}</td>
              <td className="py-2.5 text-ink-dim">{naira(c.grossProfitSnapshot)}</td>
              <td className="py-2.5 text-ink-dim">{c.commissionRate}%</td>
              <td className="py-2.5 text-ink font-medium">{naira(c.commissionAmount)}</td>
              <td className="py-2.5 text-ink-dim capitalize">{c.status}</td>
              <td className="py-2.5 whitespace-nowrap">
                {c.status === "pending" && (
                  <button onClick={() => updateStatus(c._id, "approved")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-teal">Approve</button>
                )}
                {c.status === "approved" && (
                  <button onClick={() => updateStatus(c._id, "paid")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-gold">Mark paid</button>
                )}
                {["pending", "approved"].includes(c.status) && (
                  <button onClick={() => updateStatus(c._id, "reversed")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Reverse</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
