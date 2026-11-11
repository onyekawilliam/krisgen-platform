import { useEffect, useState } from "react";

// Shows the product photo, or a neat phone outline with the model name when there is no photo yet.
export default function ProductImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`${alt} (photo coming soon)`}
        className={`flex flex-col items-center justify-center gap-4 bg-gradient-to-b from-navy-panel2 to-navy-deep text-ink-faint ${className}`}
      >
        <div className="relative h-24 w-12 rounded-[14px] border-2 border-navy-line bg-navy-deep" aria-hidden="true">
          <div className="absolute inset-1 rounded-[9px] bg-gradient-to-br from-gold/25 via-navy-panel2 to-teal/20" />
          <div className="absolute left-1/2 top-1.5 h-1 w-3 -translate-x-1/2 rounded-full bg-navy-deep" />
        </div>
        <span className="line-clamp-2 px-4 text-center text-xs text-ink-dim">{alt}</span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
