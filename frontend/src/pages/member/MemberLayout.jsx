import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/dashboard", label: "Overview", end: true },
  { to: "/dashboard/referrals", label: "My Referrals" },
  { to: "/dashboard/orders", label: "My Orders" },
  { to: "/dashboard/earnings", label: "My Earnings" },
  { to: "/dashboard/withdrawals", label: "Withdrawals" },
  { to: "/dashboard/profile", label: "Profile" },
];

export default function MemberLayout() {
  return (
    <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col md:flex-row gap-8">
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:w-48 flex-shrink-0 border-b md:border-b-0 md:border-r border-navy-line pb-2 md:pb-0 md:pr-4">
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
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
