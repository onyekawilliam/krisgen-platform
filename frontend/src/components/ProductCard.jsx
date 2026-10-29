import { Link } from "react-router-dom";
import ProductImage from "./ProductImage";

function naira(n) {
  return "₦" + Number(n).toLocaleString("en-NG");
}

export default function ProductCard({ product }) {
  return (
    <div className="card flex flex-col gap-2.5">
      <div className="aspect-square rounded-md overflow-hidden">
        <ProductImage src={product.images?.[0]} alt={product.name} className="h-full w-full object-contain" />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[11px] uppercase tracking-wide text-teal font-semibold">{product.brand}</span>
        <span className="text-[11px] text-ink-faint">{product.stock > 0 ? "In stock" : "Out of stock"}</span>
      </div>
      <h3 className="font-display font-semibold text-base">{product.name}</h3>
      <ul className="flex flex-col gap-1 font-mono text-[11px] text-ink-dim">
        {product.ram && (
          <li className="flex justify-between">
            <span>RAM</span>
            <span className="text-ink">{product.ram}</span>
          </li>
        )}
        {product.storage && (
          <li className="flex justify-between">
            <span>Storage</span>
            <span className="text-ink">{product.storage}</span>
          </li>
        )}
        {product.specifications?.camera && (
          <li className="flex justify-between">
            <span>Camera</span>
            <span className="text-ink">{product.specifications.camera}</span>
          </li>
        )}
      </ul>
      <div className="flex justify-between items-center pt-2.5 mt-1 border-t border-navy-line">
        <span className="text-lg font-display font-bold text-gold-bright">{naira(product.sellingPrice)}</span>
        <Link to={`/shop/${product._id}`} className="text-sm border border-navy-line rounded-md px-3.5 py-1.5 hover:border-teal hover:text-teal">
          View
        </Link>
      </div>
    </div>
  );
}
