import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import PasswordInput from "../../components/PasswordInput";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset your password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-5 py-16">
        <h1 className="font-display text-2xl font-bold mb-3">Reset link not valid</h1>
        <p className="text-ink-dim text-sm mb-5">This link is missing its reset code. Request a new one and use the link in the email.</p>
        <Link to="/forgot-password" className="btn-primary">Request a new link</Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl font-bold mb-1">Choose a new password</h1>
      <p className="text-ink-dim text-sm mb-6">Use at least 8 characters. You'll be signed out everywhere else.</p>

      {done ? (
        <div className="card text-sm">
          <p className="text-teal font-semibold mb-1">Password updated</p>
          <p className="text-ink-dim">Taking you to the log in page…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="new-password">New password</label>
            <PasswordInput id="new-password" required minLength={8} maxLength={72}
              autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm new password</label>
            <PasswordInput id="confirm-password" required minLength={8} maxLength={72}
              autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && (
            <p className="text-coral text-sm">
              {error} {/expired|invalid/i.test(error) && <Link to="/forgot-password" className="underline">Request a new link</Link>}
            </p>
          )}
          <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-50">
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}
