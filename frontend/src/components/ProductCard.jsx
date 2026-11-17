import { Link } from "react-router-dom";
import ProductImage from "./ProductImage";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function ProductCard({ product }) {
  const stock = Number(product.stock) || 0;
  const specs = [product.ram && `${product.ram} RAM`, product.storage, product.specifications?.camera].filter(Boolean);
  const href = `/shop/${product._id}`;

  return (
    <article className={`group card card-hover flex min-w-0 flex-col gap-3 p-3.5 ${stock === 0 ? "opacity-80" : ""}`}>
      <Link to={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-square overflow-hidden rounded-xl bg-navy-panel2">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]" />
        {stock === 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-text">Sold out</span>
        )}
        {stock > 0 && stock <= 3 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold text-brand">
            Only {stock} left
          </span>
        )}
      </Link>

      <div className="px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">{product.brand}</p>
        <h3 className="mt-1 font-display text-base font-semibold leading-snug">
          <Link to={href} className="hover:text-gold-bright">{product.name}</Link>
        </h3>
        {specs.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {specs.map((s) => (
              <li key={s} className="rounded-md bg-navy-panel2 px-2 py-1 text-[11px] font-medium text-ink-dim">{s}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-3 px-1 pt-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-display text-xl font-bold tracking-tight">{naira(product.sellingPrice)}</div>
          <div className={`mt-0.5 text-xs font-medium ${stock > 0 ? "text-mint" : "text-ink-faint"}`}>
            {stock > 0 ? "In stock" : "Out of stock"}
          </div>
        </div>
        <Link to={href} className="btn-primary w-full px-4 py-2 text-sm sm:w-auto">View</Link>
      </div>
    </article>
  );
}
