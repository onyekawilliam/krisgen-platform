// The shared frame for log in, register and password pages: a short brand panel
// beside the form on wide screens, and just the form on a phone.
import { onlinePayments } from "../config";

const points = [
  "Genuine phones at dealer prices",
  onlinePayments ? "Pay by card, bank transfer or USSD" : "Order by call or WhatsApp",
  "Free referral program, paid on real sales",
];

export default function AuthLayout({ children }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-14">
      <div className="grid overflow-hidden rounded-[28px] border border-navy-line shadow-lift md:grid-cols-[1fr_1.1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand p-10 text-brand-text md:flex">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold font-display text-sm font-bold text-brand">KC</div>
            <h2 className="mt-8 font-display text-3xl font-bold leading-tight tracking-tight">
              Phones you can trust, prices you will like.
            </h2>
            <ul className="mt-8 space-y-3.5 text-sm text-brand-dim">
              {points.map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative mt-10 text-xs text-brand-dim">
            Need help? Call or WhatsApp <span className="font-medium text-brand-text">08035142589</span>
          </p>
        </aside>
        <div className="bg-navy-panel p-7 sm:p-10">{children}</div>
      </div>
    </div>
  );
}
