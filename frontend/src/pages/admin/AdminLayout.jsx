import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const tabs = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/members", label: "Members" },
  { to: "/admin/commissions", label: "Commissions" },
  { to: "/admin/withdrawals", label: "Withdrawals" },
  { to: "/admin/settings", label: "Settings" },
  { to: "/admin/account", label: "Account" },
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-between border-b border-navy-line bg-navy-panel/40 px-6 py-3.5">
        <div className="flex items-center gap-2 font-display font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-[13px] font-bold text-navy-deep">KC</span>
          Admin
        </div>
        <button onClick={handleLogout} className="rounded-xl border border-navy-line px-4 py-2 text-sm text-ink-dim transition-colors hover:border-coral hover:text-coral">
          Log out
        </button>
      </div>
      <div className="flex flex-col md:flex-row">
        <nav aria-label="Admin" className="no-scrollbar flex flex-shrink-0 gap-1 overflow-x-auto border-b border-navy-line p-3 md:w-52 md:flex-col md:border-b-0 md:border-r">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-navy-panel font-medium text-gold-bright" : "text-ink-dim hover:bg-navy-panel/60 hover:text-ink"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 min-w-0 p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
