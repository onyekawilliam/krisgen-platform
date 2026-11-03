import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl font-bold mb-1">Reset your password</h1>
      <p className="text-ink-dim text-sm mb-6">Enter your account email and we'll send you a link to choose a new password.</p>

      {sent ? (
        <div className="card text-sm">
          <p className="text-teal font-semibold mb-1">Check your email</p>
          <p className="text-ink-dim">
            If an account exists for {email}, a reset link is on its way. It works for 1 hour. Check your spam folder if
            you don't see it.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="label" htmlFor="reset-email">Email</label>
            <input id="reset-email" type="email" className="input" required autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="text-coral text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-50">
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <p className="text-ink-dim text-sm mt-5">
        <Link to="/login" className="text-teal">Back to log in</Link>
      </p>
    </div>
  );
}
