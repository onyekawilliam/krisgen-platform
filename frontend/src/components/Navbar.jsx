import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const links = [
    { to: "/shop", label: "Phones" },
    { to: "/affiliate", label: "Affiliate Program" },
    { to: "/how-it-works", label: "How It Works" },
    { to: "/contact", label: "Contact" },
  ];

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="sticky top-0 z-50 bg-navy-deep/90 backdrop-blur border-b border-navy-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2 font-semibold font-display">
          <span className="w-8 h-8 rounded-md bg-gradient-to-br from-gold to-coral text-navy-deep flex items-center justify-center text-xs font-display font-bold">
            KC
          </span>
          Krisgen Communications
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-sm text-ink-dim hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                className="text-sm text-ink-dim hover:text-ink"
              >
                {user.role === "admin" ? "Admin" : "Dashboard"}
              </Link>
              <button onClick={handleLogout} className="btn-outline text-sm py-2 px-4">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-ink-dim hover:text-ink">
                Log in
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Join free
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden text-ink" onClick={() => setOpen(!open)} aria-label="Menu">
          ☰
        </button>
      </div>

      {open && (
        <div className="md:hidden flex flex-col border-t border-navy-line px-5 pb-4">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="py-2.5 text-sm text-ink-dim border-b border-navy-line"
            >
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to={user.role === "admin" ? "/admin" : "/dashboard"}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-ink-dim border-b border-navy-line"
              >
                {user.role === "admin" ? "Admin" : "Dashboard"}
              </Link>
              <button onClick={handleLogout} className="py-2.5 text-sm text-left text-coral">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink-dim border-b border-navy-line">
                Log in
              </Link>
              <Link to="/register" onClick={() => setOpen(false)} className="py-2.5 text-sm text-gold-bright">
                Join free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
