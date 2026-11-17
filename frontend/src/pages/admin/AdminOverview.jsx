import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

function naira(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG");
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/stats").then((res) => {
      setStats(res.data.data);
      setError("");
    }).catch(() => setError("Could not load dashboard statistics. Reload to try again."));
  }, []);

  return (
    <div>
      <h1 className="page-title mb-6">Overview</h1>
      {error && <p role="alert" className="text-coral text-sm mb-4">{error}</p>}
      {(stats?.paymentReviewCount ?? 0) > 0 && (
        <Link to="/admin/orders" className="card card-hover mb-6 block border-coral/60 bg-coral/5">
          <div className="font-display text-2xl font-bold tracking-tight text-coral">{stats.paymentReviewCount}</div>
          <div className="text-sm mt-1">Payments awaiting review — open Orders to resolve</div>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight text-gold-bright">{stats?.memberCount ?? "—"}</div><div className="mt-1.5 text-xs text-ink-dim">Members</div></div>
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight">{stats?.productCount ?? "—"}</div><div className="mt-1.5 text-xs text-ink-dim">Active products</div></div>
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight">{stats?.orderCount ?? "—"}</div><div className="mt-1.5 text-xs text-ink-dim">Confirmed orders</div></div>
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight text-teal">{naira(stats?.totalRevenue)}</div><div className="mt-1.5 text-xs text-ink-dim">Total revenue</div></div>
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight text-gold-bright">{naira(stats?.totalCommissionsOwed)}</div><div className="mt-1.5 text-xs text-ink-dim">Commissions owed</div></div>
        <div className="card"><div className="font-display text-2xl font-bold tracking-tight">{stats?.pendingWithdrawals ?? "—"}</div><div className="mt-1.5 text-xs text-ink-dim">Pending withdrawals</div></div>
      </div>
    </div>
  );
}
