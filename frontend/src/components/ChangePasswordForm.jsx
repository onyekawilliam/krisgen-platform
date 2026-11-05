import { useState } from "react";
import api from "../api/axios";
import PasswordInput from "./PasswordInput";

export default function ChangePasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (form.newPassword !== form.confirm) {
      setError("The two new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/auth/me/password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not change your password. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <div>
        <label className="label" htmlFor="current-password">Current password</label>
        <PasswordInput id="current-password" required autoComplete="current-password"
          value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="new-password">New password</label>
        <PasswordInput id="new-password" required minLength={8} maxLength={72}
          autoComplete="new-password" value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">Confirm new password</label>
        <PasswordInput id="confirm-password" required minLength={8} maxLength={72}
          autoComplete="new-password" value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
      </div>
      <p className="text-ink-faint text-xs">Use at least 8 characters. Your other devices will be signed out.</p>
      {error && <p className="text-coral text-sm">{error}</p>}
      {done && <p className="text-teal text-sm">Password updated.</p>}
      <button type="submit" disabled={saving} className="btn-primary mt-1 disabled:opacity-50">
        {saving ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
