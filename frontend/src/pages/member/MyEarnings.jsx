import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

const statusColor = {
  pending: "text-gold-bright",
  approved: "text-teal",
  paid: "text-teal",
  cancelled: "text-coral",
  reversed: "text-coral",
};

export default function MyEarnings() {
  const [commissions, setCommissions] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    api.get("/commissions/mine").then((res) => {
      setCommissions(res.data.data);
      setSummary(res.data.summary);
    });
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">My earnings</h1>
      <p className="text-ink-dim text-sm mb-6">Every commission, with the profit and rate it was calculated from.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card"><div className="text-lg font-display font-bold text-gold-bright">{naira(summary?.pending)}</div><div className="text-ink-faint text-xs mt-1">Pending</div></div>
        <div className="card"><div className="text-lg font-display font-bold text-teal">{naira(summary?.approved)}</div><div className="text-ink-faint text-xs mt-1">Approved</div></div>
        <div className="card"><div className="text-lg font-display font-bold">{naira(summary?.paid)}</div><div className="text-ink-faint text-xs mt-1">Paid out</div></div>
      </div>

      {commissions.length === 0 ? (
        <p className="text-ink-dim text-sm">No commissions yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
              <th className="py-2.5">Product</th>
              <th className="py-2.5">Type</th>
              <th className="py-2.5">Profit</th>
              <th className="py-2.5">Rate</th>
              <th className="py-2.5">Commission</th>
              <th className="py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c._id} className="border-b border-navy-line">
                <td className="py-2.5 text-ink">{c.product?.name}</td>
                <td className="py-2.5 text-ink-dim capitalize">{c.type}</td>
                <td className="py-2.5 text-ink-dim">{naira(c.grossProfitSnapshot)}</td>
                <td className="py-2.5 text-ink-dim">{c.commissionRate}%</td>
                <td className="py-2.5 text-ink font-medium">{naira(c.commissionAmount)}</td>
                <td className={`py-2.5 capitalize ${statusColor[c.status]}`}>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
