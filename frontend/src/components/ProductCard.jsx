import { Link } from "react-router-dom";
import ProductImage from "./ProductImage";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function ProductCard({ product }) {
  const inStock = product.stock > 0;
  const specs = [product.ram && `${product.ram} RAM`, product.storage, product.specifications?.camera].filter(Boolean);

  return (
    <div className="card card-hover flex flex-col gap-3 p-4">
      <Link to={`/shop/${product._id}`} tabIndex={-1} aria-hidden="true" className="block aspect-square overflow-hidden rounded-xl bg-navy-deep">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain" />
      </Link>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">{product.brand}</span>
        <span className={`badge ${inStock ? "badge-ok" : "badge-muted"}`}>{inStock ? "In stock" : "Out of stock"}</span>
      </div>

      <h3 className="font-display text-base font-semibold leading-snug">
        <Link to={`/shop/${product._id}`} className="hover:text-gold-bright">{product.name}</Link>
      </h3>

      {specs.length > 0 && <p className="text-xs leading-relaxed text-ink-dim">{specs.join(" · ")}</p>}

      <div className="mt-auto flex items-center justify-between border-t border-navy-line pt-3">
        <span className="font-display text-lg font-bold text-gold-bright">{naira(product.sellingPrice)}</span>
        <Link to={`/shop/${product._id}`} className="btn-outline px-4 py-2 text-sm">
          View
        </Link>
      </div>
    </div>
  );
}
