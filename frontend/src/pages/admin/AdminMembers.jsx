import { useEffect, useState } from "react";
import api from "../../api/axios";

export default function AdminMembers() {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");

  function load() {
    api.get("/admin/members", { params: search ? { search } : {} }).then((res) => setMembers(res.data.data));
  }
  useEffect(load, [search]);

  async function toggleStatus(m) {
    const next = m.status === "active" ? "suspended" : "active";
    await api.patch(`/admin/members/${m._id}/status`, { status: next });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-5">Members</h1>
      <input className="input max-w-sm mb-5" placeholder="Search by name, email or referral code…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-faint text-xs uppercase border-b border-navy-line">
            <th className="py-2.5">Name</th>
            <th className="py-2.5">Email</th>
            <th className="py-2.5">Referral code</th>
            <th className="py-2.5">Referred by</th>
            <th className="py-2.5">Balance</th>
            <th className="py-2.5">Status</th>
            <th className="py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m._id} className="border-b border-navy-line">
              <td className="py-2.5 text-ink">{m.name}</td>
              <td className="py-2.5 text-ink-dim">{m.email}</td>
              <td className="py-2.5 text-ink-dim font-mono">{m.referralCode}</td>
              <td className="py-2.5 text-ink-dim">{m.referredBy ? m.referredBy.name : "Direct"}</td>
              <td className="py-2.5 text-ink-dim">₦{Number(m.balance || 0).toLocaleString("en-NG")}</td>
              <td className="py-2.5 capitalize" style={{ color: m.status === "active" ? "#3E9199" : "#D97757" }}>{m.status}</td>
              <td className="py-2.5">
                <button onClick={() => toggleStatus(m)} className="text-xs border border-navy-line rounded px-2.5 py-1 hover:border-gold">
                  {m.status === "active" ? "Suspend" : "Reactivate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
