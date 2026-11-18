import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import { onlinePayments, SHOP_PHONE, SHOP_WHATSAPP_DISPLAY, whatsappUrl } from "../config";

const links = [
  { to: "/shop", label: "Phones" },
  { to: "/affiliate", label: "Affiliate Program" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/contact", label: "Contact" },
];

const brands = ["Tecno", "Infinix", "Redmi", "Itel", "Samsung", "Viva", "Realme"];

const stripLink = ({ isActive }) =>
  `relative whitespace-nowrap py-3 text-sm font-medium transition-colors ${
    isActive
      ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-gold"
      : "text-ink-dim hover:text-ink"
  }`;

const mobileLink = ({ isActive }) =>
  `rounded-xl px-3 py-3 text-sm font-medium ${isActive ? "bg-navy-panel2 text-ink" : "text-ink-dim hover:bg-navy-panel2 hover:text-ink"}`;

function SearchBox({ onDone, className = "" }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function submit(e) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
    onDone?.();
  }

  return (
    <form onSubmit={submit} role="search" className={`flex items-center overflow-hidden rounded-full border border-navy-line bg-navy-deep transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30 ${className}`}>
      <svg className="ml-4 shrink-0 text-ink-faint" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <label htmlFor="site-search" className="sr-only">Search phones</label>
      <input
        id="site-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search phones, brands and models"
        className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
      />
      <button type="submit" className="m-1 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-brand transition hover:brightness-95">
        Search
      </button>
    </form>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    setOpen(false);
    await logout();
    navigate("/");
  }

  const accountPath = user?.role === "admin" ? "/admin" : "/dashboard";
  const accountLabel = user?.role === "admin" ? "Admin" : "My account";

  return (
    <>
      <div className="bg-brand text-xs text-brand-dim">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2">
          <span className="hidden sm:inline">
            {onlinePayments ? "Genuine phones at dealer prices · Pay by card, bank transfer or USSD" : "Genuine phones at dealer prices · Order by call or WhatsApp"}
          </span>
          <span className="sm:hidden">{onlinePayments ? "Pay by card, transfer or USSD" : "Order by call or WhatsApp"}</span>
          <div className="flex items-center gap-4 whitespace-nowrap font-medium text-brand-text">
            <a href={`tel:${SHOP_PHONE}`} className="hover:text-gold">Call {SHOP_PHONE}</a>
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="hidden hover:text-gold sm:inline">
              WhatsApp {SHOP_WHATSAPP_DISPLAY}
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-navy-line bg-navy-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          <Link to="/" className="flex shrink-0 items-center gap-2.5 font-display text-lg font-bold" onClick={() => setOpen(false)}>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-gold">KC</span>
            <span className="hidden leading-tight lg:block">
              Krisgen
              <span className="block text-[11px] font-medium text-ink-faint">Communications</span>
            </span>
          </Link>

          <SearchBox className="hidden flex-1 md:flex md:max-w-xl" />

          <div className="ml-auto hidden items-center gap-1.5 md:flex">
            <ThemeToggle />
            {user ? (
              <>
                <Link to={accountPath} className="rounded-full px-4 py-2 text-sm font-medium text-ink-dim transition-colors hover:bg-navy-panel2 hover:text-ink">
                  {accountLabel}
                </Link>
                <button onClick={handleLogout} className="btn-outline px-5 py-2 text-sm">Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-full px-4 py-2 text-sm font-medium text-ink-dim transition-colors hover:bg-navy-panel2 hover:text-ink">
                  Log in
                </Link>
                <Link to="/register" className="btn-primary px-5 py-2 text-sm">Join free</Link>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-navy-panel2"
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
        </div>

        <div className="px-5 pb-3 md:hidden">
          <SearchBox />
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
                  <Link to={accountPath} onClick={() => setOpen(false)} className="btn-outline py-2.5 text-sm">{accountLabel}</Link>
                  <button onClick={handleLogout} className="rounded-xl py-2.5 text-sm font-medium text-coral">Log out</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setOpen(false)} className="btn-outline py-2.5 text-sm">Log in</Link>
                  <Link to="/register" onClick={() => setOpen(false)} className="btn-primary py-2.5 text-sm">Join free</Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <div className="hidden border-b border-navy-line bg-navy-panel md:block">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5">
          <div className="flex items-center gap-8">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={stripLink}>
                {l.label}
              </NavLink>
            ))}
          </div>
          <div className="hidden items-center gap-4 text-sm text-ink-faint lg:flex">
            {brands.slice(0, 5).map((b) => (
              <Link key={b} to={`/shop?brand=${b}`} className="transition-colors hover:text-ink">{b}</Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
