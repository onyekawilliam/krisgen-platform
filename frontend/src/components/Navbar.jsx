import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const desktopLink = ({ isActive }) =>
  `relative py-1 text-sm transition-colors ${
    isActive ? "text-ink after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-gold" : "text-ink-dim hover:text-ink"
  }`;

const mobileLink = ({ isActive }) =>
  `rounded-lg px-3 py-3 text-sm ${isActive ? "bg-navy-panel text-gold-bright" : "text-ink-dim hover:bg-navy-panel hover:text-ink"}`;

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
    setOpen(false);
    await logout();
    navigate("/");
  }

  const accountPath = user?.role === "admin" ? "/admin" : "/dashboard";
  const accountLabel = user?.role === "admin" ? "Admin" : "Dashboard";

  return (
    <header className="sticky top-0 z-50 border-b border-navy-line bg-navy-deep/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5 font-display font-semibold" onClick={() => setOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold font-display text-[13px] font-bold text-navy-deep">
            KC
          </span>
          <span className="hidden sm:inline">Krisgen Communications</span>
          <span className="sm:hidden">Krisgen</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={desktopLink}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link to={accountPath} className="px-2 text-sm text-ink-dim transition-colors hover:text-ink">
                {accountLabel}
              </Link>
              <button onClick={handleLogout} className="btn-outline px-4 py-2 text-sm">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-2 text-sm text-ink-dim transition-colors hover:text-ink">
                Log in
              </Link>
              <Link to="/register" className="btn-primary px-5 py-2 text-sm">
                Join free
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink transition-colors hover:bg-navy-panel md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="flex flex-col gap-1 border-t border-navy-line px-4 pb-4 pt-2 md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)} className={mobileLink}>
              {l.label}
            </NavLink>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-navy-line pt-3">
            {user ? (
              <>
                <Link to={accountPath} onClick={() => setOpen(false)} className="btn-outline py-2.5 text-sm">
                  {accountLabel}
                </Link>
                <button onClick={handleLogout} className="rounded-xl py-2.5 text-sm text-coral">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="btn-outline py-2.5 text-sm">
                  Log in
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="btn-primary py-2.5 text-sm">
                  Join free
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
