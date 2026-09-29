import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminSettings() {
  const [form, setForm] = useState({ directCommissionRate: "", referralOverrideRate: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/commissions/admin/settings").then((res) => setForm(res.data.data));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.patch("/commissions/admin/settings", {
      directCommissionRate: Number(form.directCommissionRate),
      referralOverrideRate: Number(form.referralOverrideRate),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Platform settings</h1>
      <p className="text-ink-dim text-sm mb-6">
        These rates apply to a product's profit, not its selling price. Changes only affect future sales —
        commissions already recorded keep their original snapshot.
      </p>

      <form onSubmit={handleSubmit} className="card max-w-sm flex flex-col gap-3">
        <div>
          <label className="label">Direct sale commission rate (%)</label>
          <input type="number" className="input" value={form.directCommissionRate} onChange={(e) => setForm({ ...form, directCommissionRate: e.target.value })} />
        </div>
        <div>
          <label className="label">Referral override rate (%)</label>
          <input type="number" className="input" value={form.referralOverrideRate} onChange={(e) => setForm({ ...form, referralOverrideRate: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary mt-2">Save settings</button>
        {saved && <p className="text-teal text-sm">Saved.</p>}
      </form>
    </div>
  );
}
