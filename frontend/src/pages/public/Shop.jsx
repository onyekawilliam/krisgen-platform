import { useEffect, useState } from "react";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

const BRANDS = ["All", "Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme"];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [brand, setBrand] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/products", { params: { brand, search: search || undefined } })
      .then((res) => setProducts(res.data.data))
      .finally(() => setLoading(false));
  }, [brand, search]);

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <h1 className="font-display text-2xl font-bold mb-1">Phones in stock</h1>
      <p className="text-ink-dim text-sm mb-6">Genuine devices, dealer pricing.</p>

      <input
        className="input mb-4 max-w-sm"
        placeholder="Search by name or model…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="flex gap-2 flex-wrap mb-6">
        {BRANDS.map((b) => (
          <button
            key={b}
            onClick={() => setBrand(b)}
            className={`text-sm px-4 py-1.5 rounded-full border ${
              brand === b ? "bg-gold text-navy-deep border-gold font-semibold" : "border-navy-line text-ink-dim hover:text-ink hover:border-gold"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-ink-dim">Loading phones…</div>
      ) : products.length === 0 ? (
        <div className="text-ink-dim">No phones match that filter.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
