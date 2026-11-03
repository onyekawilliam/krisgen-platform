import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function MyWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [available, setAvailable] = useState(0);
  const [form, setForm] = useState({ amount: "", bankName: "", accountNumber: "", accountName: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    api
      .get("/withdrawals/mine")
      .then((res) => {
        setWithdrawals(res.data.data);
        setAvailable(res.data.availableBalance);
      })
      .catch(() => setError("Could not load your withdrawals. Refresh to try again."));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/withdrawals", {
        amount: Number(form.amount),
        bankDetails: { bankName: form.bankName, accountNumber: form.accountNumber, accountName: form.accountName },
      });
      setForm({ amount: "", bankName: "", accountNumber: "", accountName: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit withdrawal request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Withdrawals</h1>
      <p className="text-ink-dim text-sm mb-6">Available balance: <span className="text-gold-bright font-semibold">{naira(available)}</span></p>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-3 max-w-sm mb-8">
        <div>
          <label className="label">Amount</label>
          <input type="number" className="input" required min="1" max={available} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div>
          <label className="label">Bank name</label>
          <input className="input" required value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
        </div>
        <div>
          <label className="label">Account number</label>
          <input className="input" required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} title="10-digit account number" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div>
          <label className="label">Account name</label>
          <input className="input" required value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
        </div>
        {error && <p className="text-coral text-sm">{error}</p>}
        <button type="submit" disabled={submitting || available <= 0} className="btn-primary disabled:opacity-50">
          {submitting ? "Submitting…" : "Request withdrawal"}
        </button>
      </form>

      <h2 className="font-display font-semibold mb-3">History</h2>
      {withdrawals.length === 0 ? (
        <p className="text-ink-dim text-sm">No withdrawal requests yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
              <th className="py-2.5">Amount</th>
              <th className="py-2.5">Status</th>
              <th className="py-2.5">Requested</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w) => (
              <tr key={w._id} className="border-b border-navy-line">
                <td className="py-2.5 text-ink">{naira(w.amount)}</td>
                <td className="py-2.5 text-ink-dim capitalize">{w.status}</td>
                <td className="py-2.5 text-ink-dim">{new Date(w.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
