import { useEffect, useState } from "react";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

const BRANDS = ["All", "Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme", "Other"];

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [brand, setBrand] = useState("All");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Wait for a pause in typing so each keystroke is not its own API request.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    api
      .get("/products", { params: { brand, search: debouncedSearch || undefined } })
      .then((res) => current && setProducts(res.data.data))
      .catch(() => current && setError("Could not load phones. Check your connection and try again."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [brand, debouncedSearch]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="eyebrow mb-2">The shop</p>
      <h1 className="page-title">Phones in stock</h1>
      <p className="mb-7 mt-2 text-sm text-ink-dim">Genuine devices, dealer pricing.</p>

      <div className="relative mb-5 max-w-md">
        <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <label htmlFor="shop-search" className="sr-only">Search phones</label>
        <input
          id="shop-search"
          type="search"
          className="input pl-10"
          placeholder="Search by name or model"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by brand">
        {BRANDS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrand(b)}
            aria-pressed={brand === b}
            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
              brand === b
                ? "border-gold bg-gold font-semibold text-navy-deep"
                : "border-navy-line text-ink-dim hover:border-gold hover:text-ink"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true" aria-label="Loading phones">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card h-80 animate-pulse bg-navy-panel/60" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="card text-sm text-coral">{error}</div>
      ) : products.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="font-display text-lg font-semibold">No phones match that filter</p>
          <p className="mt-1 text-sm text-ink-dim">Try another brand or clear the search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
