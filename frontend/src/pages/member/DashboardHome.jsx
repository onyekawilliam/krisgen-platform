import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

function naira(n) {
  return "₦" + Number(n || 0).toLocaleString("en-NG");
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [referralCount, setReferralCount] = useState(0);

  useEffect(() => {
    api.get("/commissions/mine").then((res) => setSummary(res.data.summary));
    api.get("/referrals/mine").then((res) => setReferralCount(res.data.data.length));
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${user?.referralCode}`;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">Welcome back, {user?.name?.split(" ")[0]}</h1>
      <p className="text-ink-dim text-sm mb-6">Here's how your referral activity is doing.</p>

      <div className="card mb-6">
        <div className="label">Your referral link</div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-mono text-sm text-gold-bright break-all">{referralLink}</code>
          <button
            className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-gold"
            onClick={() => navigator.clipboard.writeText(referralLink)}
          >
            Copy
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="text-xl font-display font-bold text-gold-bright">{naira(summary?.total)}</div>
          <div className="text-ink-faint text-xs mt-1">Total earned</div>
        </div>
        <div className="card">
          <div className="text-xl font-display font-bold">{naira(summary?.pending)}</div>
          <div className="text-ink-faint text-xs mt-1">Pending review</div>
        </div>
        <div className="card">
          <div className="text-xl font-display font-bold">{naira(summary?.approved)}</div>
          <div className="text-ink-faint text-xs mt-1">Approved (withdrawable)</div>
        </div>
        <div className="card">
          <div className="text-xl font-display font-bold">{referralCount}</div>
          <div className="text-ink-faint text-xs mt-1">People referred</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link to="/dashboard/earnings" className="btn-outline text-sm py-2 px-4">View earnings</Link>
        <Link to="/dashboard/withdrawals" className="btn-outline text-sm py-2 px-4">Request withdrawal</Link>
      </div>
    </div>
  );
}
