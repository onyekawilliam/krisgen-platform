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
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 md:flex-row md:gap-10">
      <nav aria-label="Dashboard" className="no-scrollbar flex flex-shrink-0 gap-1 overflow-x-auto border-b border-navy-line pb-3 md:w-52 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-5">
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
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
