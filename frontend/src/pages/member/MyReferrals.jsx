import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function MyReferrals() {
  const [referrals, setReferrals] = useState([]);
  const [link, setLink] = useState("");

  useEffect(() => {
    api.get("/referrals/mine").then((res) => {
      setReferrals(res.data.data);
      setLink(res.data.referralLink);
    });
  }, []);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-1">My referrals</h1>
      <p className="text-ink-dim text-sm mb-6">Everyone who registered with your link. One level — no downline tree.</p>

      <div className="card mb-6">
        <div className="label">Your referral link</div>
        <code className="font-mono text-sm text-gold-bright break-all">{link}</code>
      </div>

      {referrals.length === 0 ? (
        <p className="text-ink-dim text-sm">No referrals yet — share your link to get started.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
              <th className="py-2.5">Name</th>
              <th className="py-2.5">Email</th>
              <th className="py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r._id} className="border-b border-navy-line">
                <td className="py-2.5 text-ink">{r.referred?.name}</td>
                <td className="py-2.5 text-ink-dim">{r.referred?.email}</td>
                <td className="py-2.5 text-ink-dim">{new Date(r.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
