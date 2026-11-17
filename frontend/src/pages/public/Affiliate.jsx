import { Link } from "react-router-dom";

export default function Affiliate() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <p className="eyebrow mb-3">Affiliate Program</p>
      <h1 className="page-title max-w-2xl md:text-4xl">Earn from sales, not from recruiting</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-ink-dim">
        Registration is free — no fee, no starter purchase. You get a personal referral link the moment you sign up.
        Two ways to earn, both tied to an actual phone being sold.
      </p>

      <div className="mb-10 mt-10 grid gap-5 md:grid-cols-2">
        <div className="card p-6">
          <span className="font-mono text-sm text-gold-bright">01</span>
          <h2 className="mb-2 mt-2 font-display text-lg font-semibold">Direct sale</h2>
          <p className="text-sm leading-relaxed text-ink-dim">
            You sell a phone — to a customer using your link. You earn a commission on the profit
            Krisgen makes on that sale.
          </p>
        </div>
        <div className="card p-6">
          <span className="font-mono text-sm text-gold-bright">02</span>
          <h2 className="mb-2 mt-2 font-display text-lg font-semibold">Referral override</h2>
          <p className="text-sm leading-relaxed text-ink-dim">
            Someone you referred makes a direct sale. You earn a smaller share of that same sale's profit — one
            level only, nothing cascades further down.
          </p>
        </div>
      </div>

      <div className="card mb-8 p-7">
        <h3 className="mb-4 font-display font-semibold">Example <span className="text-sm font-normal text-ink-faint">(illustrative figures)</span></h3>
        <div className="space-y-3 font-mono text-sm text-ink-dim">
          <div className="flex justify-between"><span>Selling price</span><span className="text-ink">₦100,000</span></div>
          <div className="flex justify-between"><span>Cost price</span><span className="text-ink">₦80,000</span></div>
          <div className="flex justify-between border-t border-navy-line pt-3"><span>Gross profit</span><span className="text-ink">₦20,000</span></div>
          <div className="flex justify-between"><span>Seller earns (15%)</span><span className="font-semibold text-gold-bright">₦3,000</span></div>
          <div className="flex justify-between"><span>Seller's referrer earns (5%)</span><span className="font-semibold text-gold-bright">₦1,000</span></div>
        </div>
      </div>

      <p className="mb-8 max-w-2xl text-xs leading-relaxed text-ink-faint">
        Commissions are calculated from Krisgen's actual profit on each sale, never from the phone's full price, and
        the referral override goes one level up only — there's no multi-level structure to fill or wait on.
      </p>

      <Link to="/register" className="btn-primary">Get your free referral link</Link>
    </div>
  );
}
