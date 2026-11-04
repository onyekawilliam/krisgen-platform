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
      <div className="flex justify-between items-center px-6 py-4 border-b border-navy-line">
        <div className="flex items-center gap-2 font-display font-semibold">
          <span className="w-8 h-8 rounded-md bg-gradient-to-br from-gold to-coral text-navy-deep flex items-center justify-center text-xs font-bold">KC</span>
          Admin
        </div>
        <button onClick={handleLogout} className="text-sm border border-navy-line rounded-md px-4 py-1.5 text-ink-dim hover:border-coral hover:text-coral">
          Log out
        </button>
      </div>
      <div className="flex flex-col md:flex-row">
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-navy-line p-3">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap text-sm px-3 py-2 rounded-md ${
                  isActive ? "bg-navy-panel text-gold-bright font-medium" : "text-ink-dim hover:text-ink"
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
