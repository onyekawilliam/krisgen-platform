import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import ProductCard from "../../components/ProductCard";

const BRANDS = ["All", "Tecno", "Infinix", "Itel", "Viva", "Samsung", "Redmi", "Realme", "Other"];
const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];
const PAGE_SIZE = 12;

export default function Shop() {
  // The address bar is the source of truth, so a filtered shop can be shared or bookmarked.
  const [searchParams, setSearchParams] = useSearchParams();
  const brandParam = searchParams.get("brand");
  const brand = BRANDS.includes(brandParam) ? brandParam : "All";
  const q = searchParams.get("q") || "";
  const sortParam = searchParams.get("sort");
  const sort = SORTS.some((s) => s.value === sortParam) ? sortParam : "newest";

  const [searchText, setSearchText] = useState(q);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  function update(changes) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (!value || value === "All" || (key === "sort" && value === "newest")) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true }
    );
  }

  // The header search box changes ?q=, so keep this box in step with it.
  useEffect(() => setSearchText(q), [q]);

  // Wait for a pause in typing so each keystroke is not its own API request.
  useEffect(() => {
    if (searchText.trim() === q) return undefined;
    const timer = setTimeout(() => update({ q: searchText.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    setPage(1);
    api
      .get("/products", { params: { brand, search: q || undefined, sort, limit: PAGE_SIZE, page: 1 } })
      .then((res) => {
        if (!current) return;
        setProducts(res.data.data);
        setTotal(res.data.meta?.total ?? res.data.data.length);
      })
      .catch(() => current && setError("Could not load phones. Check your connection and try again."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [brand, q, sort]);

  async function loadMore() {
    const next = page + 1;
    setLoadingMore(true);
    try {
      const res = await api.get("/products", { params: { brand, search: q || undefined, sort, limit: PAGE_SIZE, page: next } });
      setProducts((current) => [...current, ...res.data.data]);
      setPage(next);
    } catch {
      setError("Could not load more phones. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const title = q ? `Results for “${q}”` : brand === "All" ? "Phones in stock" : `${brand} phones`;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-ink-faint">
        <Link to="/" className="hover:text-ink">Home</Link> <span aria-hidden="true">/</span> <span className="text-ink-dim">Phones</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="mt-1.5 text-sm text-ink-dim">
            {loading ? "Loading phones…" : `${total} ${total === 1 ? "phone" : "phones"} · genuine devices, dealer pricing`}
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
            <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <label htmlFor="shop-search" className="sr-only">Filter phones</label>
            <input
              id="shop-search"
              type="search"
              className="input rounded-full pl-10"
              placeholder="Filter by name or model"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="shop-sort" className="sr-only">Sort phones</label>
            <select id="shop-sort" className="input rounded-full pr-8" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="no-scrollbar -mx-5 mt-6 flex gap-2 overflow-x-auto px-5 pb-2" role="group" aria-label="Filter by brand">
        {BRANDS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => update({ brand: b })}
            aria-pressed={brand === b}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              brand === b
                ? "border-brand bg-brand text-brand-text"
                : "border-navy-line bg-navy-panel text-ink-dim hover:border-ink-faint hover:text-ink"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading phones">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card h-[22rem] animate-pulse" />
            ))}
          </div>
        ) : error && products.length === 0 ? (
          <div role="alert" className="card text-sm text-coral">{error}</div>
        ) : products.length === 0 ? (
          <div className="card py-14 text-center">
            <p className="font-display text-lg font-semibold">No phones match that search</p>
            <p className="mt-1 text-sm text-ink-dim">Try another brand or a shorter search.</p>
            <button type="button" className="btn-outline mt-5 px-5 py-2.5 text-sm" onClick={() => { setSearchText(""); setSearchParams({}, { replace: true }); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p._id} product={p} />
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <p className="text-sm text-ink-dim">Showing {products.length} of {total}</p>
              {products.length < total && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-outline px-8">
                  {loadingMore ? "Loading…" : "Show more phones"}
                </button>
              )}
              {error && <p role="alert" className="text-sm text-coral">{error}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
