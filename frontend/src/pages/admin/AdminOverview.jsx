import { useEffect, useState } from "react";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG");
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then((res) => setStats(res.data.data));
  }, []);

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-5">Overview</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card"><div className="text-xl font-display font-bold text-gold-bright">{stats?.memberCount ?? "—"}</div><div className="text-ink-faint text-xs mt-1">Members</div></div>
        <div className="card"><div className="text-xl font-display font-bold">{stats?.productCount ?? "—"}</div><div className="text-ink-faint text-xs mt-1">Active products</div></div>
        <div className="card"><div className="text-xl font-display font-bold">{stats?.orderCount ?? "—"}</div><div className="text-ink-faint text-xs mt-1">Confirmed orders</div></div>
        <div className="card"><div className="text-xl font-display font-bold text-teal">{naira(stats?.totalRevenue)}</div><div className="text-ink-faint text-xs mt-1">Total revenue</div></div>
        <div className="card"><div className="text-xl font-display font-bold text-gold-bright">{naira(stats?.totalCommissionsOwed)}</div><div className="text-ink-faint text-xs mt-1">Commissions owed</div></div>
        <div className="card"><div className="text-xl font-display font-bold">{stats?.pendingWithdrawals ?? "—"}</div><div className="text-ink-faint text-xs mt-1">Pending withdrawals</div></div>
      </div>
    </div>
  );
}
