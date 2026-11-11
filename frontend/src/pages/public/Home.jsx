import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

const trust = [
  {
    label: "Genuine devices",
    icon: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  },
  {
    label: "Card, transfer or USSD",
    icon: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></>,
  },
  {
    label: "Delivered to your address",
    icon: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  },
  {
    label: "Free referral program",
    icon: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M17 8v6M14 11h6" /></>,
  },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get("/products", { params: { limit: 4 } })
      .then((res) => setFeatured(res.data.data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-5 pb-14 pt-12 md:flex-row md:pt-20">
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-4">Krisgen Communications Ltd</p>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Genuine phones at dealer prices.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-dim">
            Buy a phone directly, or join free and earn a share of the profit on every sale your referral link brings in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary">Shop phones</Link>
            <Link to="/affiliate" className="btn-outline">How referrals work</Link>
          </div>
          <p className="mt-5 text-sm text-ink-faint">Pay by card, bank transfer or USSD.</p>
        </div>

        <div aria-hidden="true" className="relative h-72 w-full max-w-md flex-1 overflow-hidden rounded-[28px] border border-navy-line bg-[radial-gradient(circle_at_50%_38%,#1B2850_0%,#121A2E_55%,#0F1628_100%)] md:h-96">
          <div className="absolute -bottom-6 left-[12%] h-56 w-28 -rotate-[9deg] rounded-[24px] border-[3px] border-navy-line bg-navy-deep md:h-64 md:w-32">
            <div className="absolute inset-1.5 rounded-[18px] bg-gradient-to-br from-[#3A4C86] to-[#1B2447]" />
          </div>
          <div className="absolute -bottom-3 left-[34%] z-10 h-64 w-32 rounded-[26px] border-[3px] border-[#33426E] bg-navy-deep md:h-72 md:w-36">
            <div className="absolute inset-1.5 rounded-[20px] bg-gradient-to-br from-gold via-[#B5532F] to-[#3A1D2B]" />
            <div className="absolute left-1/2 top-2.5 h-1.5 w-7 -translate-x-1/2 rounded-full bg-navy-deep" />
          </div>
          <div className="absolute -bottom-5 right-[8%] h-56 w-28 rotate-[8deg] rounded-[24px] border-[3px] border-navy-line bg-navy-deep md:h-64 md:w-32">
            <div className="absolute inset-1.5 rounded-[18px] bg-gradient-to-br from-teal to-[#16303F]" />
          </div>
        </div>
      </section>

      <section className="border-y border-navy-line bg-navy-panel/50">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-5 py-6 md:grid-cols-4">
          {trust.map((t) => (
            <li key={t.label} className="flex items-center gap-3 text-sm">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gold" aria-hidden="true">
                {t.icon}
              </svg>
              {t.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-6 pt-16">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Featured phones</h2>
          <Link to="/shop" className="text-sm font-medium text-teal hover:text-ink">See all →</Link>
        </div>
        {!loaded ? null : featured.length === 0 ? (
          <p className="text-sm text-ink-dim">New phones are on their way. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-16 border-y border-navy-line bg-navy-panel/50 py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-3">Affiliate Program</p>
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight">Free to join. Paid on real sales.</h2>
            <p className="mt-4 leading-relaxed text-ink-dim">
              No fee to register, nothing to buy to unlock earning. Share your link, and when a sale you referred goes
              through, you get a cut of the profit Krisgen makes on it.
            </p>
            <Link to="/register" className="btn-primary mt-7">Get your referral link</Link>
          </div>
          <div className="card p-7">
            <div className="mb-4 text-sm text-ink-dim">
              Example commission <span className="text-ink-faint">(illustrative figures)</span>
            </div>
            <div className="space-y-3 font-mono text-sm text-ink-dim">
              <div className="flex justify-between"><span>Selling price</span><span className="text-ink">₦100,000</span></div>
              <div className="flex justify-between"><span>Cost price</span><span className="text-ink">₦80,000</span></div>
              <div className="flex justify-between border-t border-navy-line pt-3"><span>Gross profit</span><span className="text-ink">₦20,000</span></div>
              <div className="flex justify-between"><span>Direct-seller commission (15%)</span><span className="font-semibold text-gold-bright">₦3,000</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
