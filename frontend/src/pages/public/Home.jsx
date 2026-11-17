import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

const brands = ["Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme"];

const perks = [
  {
    title: "Genuine devices",
    text: "Real phones from the brands you know, at dealer prices.",
    icon: <><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6l8-3z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  },
  {
    title: "Pay your way",
    text: "Card, bank transfer or USSD, confirmed straight away.",
    icon: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></>,
  },
  {
    title: "Delivery or pickup",
    text: "Delivered to your town, or collect it from our shop.",
    icon: <><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  },
  {
    title: "Earn by sharing",
    text: "Join free and earn a share of the profit on sales you refer.",
    icon: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M17 8v6M14 11h6" /></>,
  },
];

const steps = [
  { n: "01", title: "Pick your phone", text: "Browse by brand or search for a model, and check the price and stock." },
  { n: "02", title: "Pay securely", text: "Pay by card, bank transfer or USSD. We confirm your payment before we ship." },
  { n: "03", title: "Get your phone", text: "We deliver it to your town, or you collect it from our shop." },
];

function Icon({ children, className = "" }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

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
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-6 md:pt-8">
        <div className="relative overflow-hidden rounded-[28px] border border-brand-line bg-brand px-6 py-12 text-brand-text md:px-14 md:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-teal/20 blur-3xl" />

          <div className="relative grid items-center gap-10 md:grid-cols-[1.15fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-brand-raised px-3.5 py-1.5 text-xs font-medium text-brand-dim">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Krisgen Communications Ltd
              </span>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.04] tracking-tight md:text-6xl">
                Genuine phones at <span className="text-gold">dealer prices.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-brand-dim">
                Buy a phone directly, or join free and earn a share of the profit on every sale your referral link brings in.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/shop" className="btn-primary px-7 py-3.5 text-base">Shop phones</Link>
                <Link to="/affiliate" className="inline-flex items-center justify-center rounded-full border border-brand-line px-7 py-3.5 text-base font-medium text-brand-text transition hover:bg-brand-raised">
                  How referrals work
                </Link>
              </div>
              <p className="mt-5 text-sm text-brand-dim">Pay by card, bank transfer or USSD.</p>
            </div>

            <div aria-hidden="true" className="relative mx-auto h-64 w-full max-w-sm md:h-[22rem]">
              <div className="absolute bottom-0 left-[6%] h-52 w-28 -rotate-[10deg] rounded-[26px] border-[3px] border-brand-line bg-brand md:h-64 md:w-32">
                <div className="absolute inset-1.5 rounded-[20px] bg-gradient-to-br from-[#5B74D9] to-[#1D2750]" />
              </div>
              <div className="absolute bottom-2 left-1/2 z-10 h-64 w-32 -translate-x-1/2 rounded-[28px] border-[3px] border-[#34426F] bg-brand shadow-2xl md:h-80 md:w-40">
                <div className="absolute inset-1.5 rounded-[22px] bg-gradient-to-br from-gold via-[#E2723B] to-[#5A1F3A]" />
                <div className="absolute left-1/2 top-2.5 h-1.5 w-8 -translate-x-1/2 rounded-full bg-brand" />
              </div>
              <div className="absolute bottom-0 right-[6%] h-52 w-28 rotate-[10deg] rounded-[26px] border-[3px] border-brand-line bg-brand md:h-64 md:w-32">
                <div className="absolute inset-1.5 rounded-[20px] bg-gradient-to-br from-[#4FC3CF] to-[#15303F]" />
              </div>
            </div>
          </div>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {perks.map((p) => (
            <li key={p.title} className="card flex items-start gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-bright">
                <Icon>{p.icon}</Icon>
              </span>
              <div>
                <div className="text-sm font-semibold">{p.title}</div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{p.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Brands */}
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="section-title">Shop by brand</h2>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {brands.map((b) => (
            <li key={b}>
              <Link to={`/shop?brand=${b}`} className="card card-hover flex flex-col items-center gap-2.5 px-3 py-5 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-gold">
                  {b[0]}
                </span>
                <span className="text-sm font-semibold">{b}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="mb-6 flex items-baseline justify-between gap-3">
          <h2 className="section-title">Featured phones</h2>
          <Link to="/shop" className="text-sm font-semibold text-teal hover:underline">See all phones →</Link>
        </div>
        {!loaded ? null : featured.length === 0 ? (
          <p className="text-sm text-ink-dim">New phones are on their way. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* How buying works */}
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <h2 className="section-title mb-6">Buying is simple</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="card p-6">
              <span className="font-mono text-sm font-medium text-gold-bright">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-dim">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Referral programme */}
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="grid items-center gap-10 overflow-hidden rounded-[28px] border border-brand-line bg-brand px-6 py-12 text-brand-text md:grid-cols-2 md:px-14">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Affiliate program</p>
            <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Free to join. Paid on real sales.</h2>
            <p className="mt-4 leading-relaxed text-brand-dim">
              No fee to register, nothing to buy to unlock earning. Share your link, and when a sale you referred goes
              through, you get a cut of the profit Krisgen makes on it.
            </p>
            <Link to="/register" className="btn-primary mt-7 px-7 py-3.5">Get your referral link</Link>
          </div>
          <div className="rounded-2xl border border-brand-line bg-brand-raised p-7">
            <div className="mb-4 text-sm text-brand-dim">
              Example commission <span className="opacity-75">(illustrative figures)</span>
            </div>
            <div className="space-y-3 font-mono text-sm text-brand-dim">
              <div className="flex justify-between"><span>Selling price</span><span className="text-brand-text">₦100,000</span></div>
              <div className="flex justify-between"><span>Cost price</span><span className="text-brand-text">₦80,000</span></div>
              <div className="flex justify-between border-t border-brand-line pt-3"><span>Gross profit</span><span className="text-brand-text">₦20,000</span></div>
              <div className="flex justify-between"><span>Direct-seller commission (15%)</span><span className="font-semibold text-gold">₦3,000</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Help */}
      <section className="mx-auto max-w-6xl px-5 pt-16">
        <div className="card flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center md:p-9">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">Not sure which phone to choose?</h2>
            <p className="mt-1.5 text-sm text-ink-dim">Call or WhatsApp us and we will help you pick the right one.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="tel:08035142589" className="btn-outline">Call 08035142589</a>
            <a href="https://wa.me/2348035142589" target="_blank" rel="noopener noreferrer" className="btn-primary">WhatsApp us</a>
          </div>
        </div>
      </section>
    </div>
  );
}
