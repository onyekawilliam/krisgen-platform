import { useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import ChangePasswordForm from "../../components/ChangePasswordForm";

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const res = await api.patch("/auth/me", form);
    setUser(res.data.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-sm">
      <h1 className="font-display text-2xl font-bold mb-1">Profile</h1>
      <p className="text-ink-dim text-sm mb-6">Update your account details.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Phone number</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60" value={user?.email} disabled />
        </div>
        <div>
          <label className="label">Referral code</label>
          <input className="input opacity-60 font-mono" value={user?.referralCode} disabled />
        </div>
        <button type="submit" className="btn-primary mt-2">Save changes</button>
        {saved && <p className="text-teal text-sm">Saved.</p>}
      </form>

      <h2 className="font-display font-semibold mt-10 mb-3">Change password</h2>
      <ChangePasswordForm />
    </div>
  );
}
