import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await login(form.email, form.password);
      const dest = location.state?.from || (user.role === "admin" ? "/admin" : "/dashboard");
      navigate(dest);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-5 py-16">
      <h1 className="font-display text-2xl font-bold mb-1">Log in</h1>
      <p className="text-ink-dim text-sm mb-6">Access your dashboard, referrals and orders.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label">Password</label>
          <PasswordInput autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Link to="/forgot-password" className="text-teal text-xs mt-1.5 inline-block">Forgot your password?</Link>
        </div>

        {error && <p className="text-coral text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary mt-2 disabled:opacity-50">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="text-ink-dim text-sm mt-5">
        No account? <Link to="/register" className="text-teal">Register free</Link>
      </p>
    </div>
  );
}
