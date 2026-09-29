import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState("");

  function load() {
    api.get("/withdrawals/admin/all", { params: filter ? { status: filter } : {} }).then((res) => setWithdrawals(res.data.data));
  }
  useEffect(load, [filter]);

  async function updateStatus(id, status) {
    await api.patch(`/withdrawals/admin/${id}`, { status });
    load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl font-bold">Withdrawals</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "approved", "rejected", "paid"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Member</th>
            <th className="py-2.5">Amount</th>
            <th className="py-2.5">Bank</th>
            <th className="py-2.5">Status</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((w) => (
            <tr key={w._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink">{w.user?.name}</td>
              <td className="py-2.5 text-ink-dim">{naira(w.amount)}</td>
              <td className="py-2.5 text-ink-dim">{w.bankDetails?.bankName} — {w.bankDetails?.accountNumber}</td>
              <td className="py-2.5 text-ink-dim capitalize">{w.status}</td>
              <td className="py-2.5 whitespace-nowrap">
                {w.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(w._id, "approved")} className="text-xs border border-navy-line rounded px-2.5 py-1 mr-1.5 hover:border-teal">Approve</button>
                    <button onClick={() => updateStatus(w._id, "rejected")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-coral hover:text-coral">Reject</button>
                  </>
                )}
                {w.status === "approved" && (
                  <button onClick={() => updateStatus(w._id, "paid")} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-gold">Mark paid</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
