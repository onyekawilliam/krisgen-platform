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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/commissions/mine").then((res) => setSummary(res.data.summary));
    api.get("/referrals/mine").then((res) => setReferralCount(res.data.data.length));
  }, []);

  const referralLink = `${window.location.origin}/register?ref=${user?.referralCode}`;

  return (
    <div>
      <h1 className="page-title mb-1">Welcome back, {user?.name?.split(" ")[0]}</h1>
      <p className="text-ink-dim text-sm mb-6">Here's how your referral activity is doing.</p>

      <div className="card mb-6 border-gold/30 bg-gradient-to-br from-navy-panel to-navy-panel2/60">
        <div className="label">Your referral link</div>
        <div className="flex flex-wrap items-center gap-3">
          <code className="min-w-0 break-all font-mono text-sm text-gold-bright">{referralLink}</code>
          <button
            type="button"
            className="btn-outline px-4 py-2 text-xs"
            onClick={() => {
              navigator.clipboard?.writeText(referralLink).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }).catch(() => {});
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="font-display text-2xl font-bold tracking-tight text-gold-bright">{naira(summary?.total)}</div>
          <div className="mt-1.5 text-xs text-ink-dim">Total earned</div>
        </div>
        <div className="card">
          <div className="font-display text-2xl font-bold tracking-tight">{naira(summary?.pending)}</div>
          <div className="mt-1.5 text-xs text-ink-dim">Pending review</div>
        </div>
        <div className="card">
          <div className="font-display text-2xl font-bold tracking-tight">{naira(summary?.available)}</div>
          <div className="mt-1.5 text-xs text-ink-dim">Available to withdraw</div>
        </div>
        <div className="card">
          <div className="font-display text-2xl font-bold tracking-tight">{referralCount}</div>
          <div className="mt-1.5 text-xs text-ink-dim">People referred</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link to="/dashboard/earnings" className="btn-outline text-sm py-2 px-4">View earnings</Link>
        <Link to="/dashboard/withdrawals" className="btn-outline text-sm py-2 px-4">Request withdrawal</Link>
      </div>
    </div>
  );
}
