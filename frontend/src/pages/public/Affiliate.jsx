import { Link } from "react-router-dom";

export default function Affiliate() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14">
      <p className="text-teal text-sm font-semibold mb-2">Affiliate Program</p>
      <h1 className="font-display text-3xl font-bold mb-4">Earn from sales, not from recruiting</h1>
      <p className="text-ink-dim mb-8">
        Registration is free — no fee, no starter purchase. You get a personal referral link the moment you sign up.
        Two ways to earn, both tied to an actual phone being sold.
      </p>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <div className="card">
          <h2 className="font-display font-semibold mb-2">Direct sale</h2>
          <p className="text-ink-dim text-sm">
            You sell a phone — to a customer using your link. You earn a commission on the profit
            Krisgen makes on that sale.
          </p>
        </div>
        <div className="card">
          <h2 className="font-display font-semibold mb-2">Referral override</h2>
          <p className="text-ink-dim text-sm">
            Someone you referred makes a direct sale. You earn a smaller share of that same sale's profit — one
            level only, nothing cascades further down.
          </p>
        </div>
      </div>

      <div className="card mb-10">
        <h3 className="font-display font-semibold mb-3">Example</h3>
        <div className="font-mono text-sm text-ink-dim space-y-1.5">
          <div className="flex justify-between"><span>Selling price</span><span className="text-ink">₦350,000</span></div>
          <div className="flex justify-between"><span>Cost price</span><span className="text-ink">₦300,000</span></div>
          <div className="flex justify-between pt-2 border-t border-navy-line"><span>Gross profit</span><span className="text-ink">₦50,000</span></div>
          <div className="flex justify-between"><span>Seller earns (15%)</span><span className="text-gold-bright">₦7,500</span></div>
          <div className="flex justify-between"><span>Seller's referrer earns (5%)</span><span className="text-gold-bright">₦2,500</span></div>
        </div>
      </div>

      <p className="text-ink-faint text-xs mb-8">
        Commissions are calculated from Krisgen's actual profit on each sale, never from the phone's full price, and
        the referral override goes one level up only — there's no multi-level structure to fill or wait on.
      </p>

      <Link to="/register" className="btn-primary">Get your free referral link</Link>
    </div>
  );
}
