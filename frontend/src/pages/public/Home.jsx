import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

export default function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.get("/products", { params: { limit: 4 } }).then((res) => setFeatured(res.data.data));
  }, []);

  return (
    <div>
      <section className="max-w-6xl mx-auto px-5 pt-14 pb-10">
        <p className="text-teal text-sm font-semibold mb-2">Krisgen Communications</p>
        <h1 className="font-display text-3xl md:text-4xl font-bold max-w-xl">
          Genuine phones at dealer prices, plus a free program that pays you for referring sales.
        </h1>
        <p className="text-ink-dim mt-3 max-w-lg">
          Buy a phone directly, or register free to get a referral link and earn a share of the profit on every sale
          it brings in.
        </p>
        <div className="flex gap-3 mt-6">
          <Link to="/shop" className="btn-primary">Shop phones</Link>
          <Link to="/affiliate" className="btn-outline">How referrals work</Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="flex justify-between items-baseline mb-5">
          <h2 className="font-display text-xl font-semibold">Featured phones</h2>
          <Link to="/shop" className="text-sm text-teal">See all →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {featured.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      </section>

      <section className="bg-navy-panel border-y border-navy-line py-12">
        <div className="max-w-6xl mx-auto px-5 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-teal text-sm font-semibold mb-2">Affiliate Program</p>
            <h2 className="font-display text-2xl font-bold mb-3">Free to join. Paid on real sales.</h2>
            <p className="text-ink-dim text-sm">
              No fee to register, nothing to buy to unlock earning. Share your link — when a sale you referred goes
              through, you get a cut of the profit Krisgen makes on it.
            </p>
            <Link to="/register" className="btn-primary inline-block mt-5">Get your referral link</Link>
          </div>
          <div className="card">
            <div className="text-ink-dim text-sm mb-1">Example commission</div>
            <div className="font-mono text-sm text-ink-dim space-y-1">
              <div>Selling price <span className="text-ink float-right">₦350,000</span></div>
              <div>Cost price <span className="text-ink float-right">₦300,000</span></div>
              <div className="pt-2 border-t border-navy-line">Gross profit <span className="text-ink float-right">₦50,000</span></div>
              <div>Direct-seller commission (15%) <span className="text-gold-bright float-right">₦7,500</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
