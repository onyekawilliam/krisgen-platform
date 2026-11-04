import { useEffect, useState } from "react";

// Shows the product photo, or a neat phone outline with the model name when there is no photo yet.
export default function ProductImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div role="img" aria-label={`${alt} (photo coming soon)`}
        className={`flex flex-col items-center justify-center gap-3 bg-navy-deep text-ink-faint ${className}`}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="7" y="2" width="10" height="20" rx="2.2" />
          <path d="M11 18.5h2" />
        </svg>
        <span className="text-xs text-ink-dim text-center px-3 line-clamp-2">{alt}</span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
