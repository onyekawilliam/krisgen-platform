import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useConfirm } from "../../components/ConfirmDialog";
import StatusBadge from "../../components/StatusBadge";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function AdminWithdrawals() {
  const [confirm, confirmDialog] = useConfirm();
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  function load() {
    api
      .get("/withdrawals/admin/all", { params: filter ? { status: filter } : {} })
      .then((res) => setWithdrawals(res.data.data))
      .catch(() => setError("Could not load withdrawals. Refresh to try again."));
  }
  useEffect(load, [filter]);

  async function updateStatus(id, status, confirmation) {
    if (confirmation && !(await confirm(confirmation))) return;
    setError("");
    try {
      await api.patch(`/withdrawals/admin/${id}`, { status });
    } catch (err) {
      setError(err.response?.data?.message || "Could not update this withdrawal.");
    }
    load();
  }

  return (
    <div>
      {confirmDialog}
      <div className="flex justify-between items-center mb-5">
        <h1 className="page-title">Withdrawals</h1>
        <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {["pending", "approved", "rejected", "paid"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {error && <p className="text-coral text-sm mb-4">{error}</p>}

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
              <td className="py-2.5"><StatusBadge status={w.status} /></td>
              <td className="py-2.5 whitespace-nowrap">
                {w.status === "pending" && (
                  <>
                    <button onClick={() => updateStatus(w._id, "approved")} className="text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors mr-1.5 hover:border-teal">Approve</button>
                    <button onClick={() => updateStatus(w._id, "rejected", { title: "Reject this withdrawal?", message: "The amount returns to the member's balance.", confirmLabel: "Reject", danger: true })} className="text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors hover:border-coral hover:text-coral">Reject</button>
                  </>
                )}
                {w.status === "approved" && (
                  <button onClick={() => updateStatus(w._id, "paid", { title: "Mark this withdrawal as paid?", message: "Confirm you have transferred this amount to the member's bank account. A paid withdrawal cannot be undone.", confirmLabel: "Yes, it is paid" })} className="text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors hover:border-gold">Mark paid</button>
                )}
                {w.status === "approved" && (
                  <button onClick={() => updateStatus(w._id, "rejected", { title: "Reject this approved withdrawal?", message: "Only do this if no money has been sent.", confirmLabel: "Reject", danger: true })} className="text-xs border border-navy-line rounded-lg px-3 py-1.5 transition-colors ml-1.5 hover:border-coral hover:text-coral">Reject</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
