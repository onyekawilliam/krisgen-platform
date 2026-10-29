import { useEffect, useState } from "react";

export default function ProductImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div role="img" aria-label={`${alt} image unavailable`}
        className={`flex items-center justify-center bg-navy-deep text-ink-faint text-xs ${className}`}>
        Image unavailable
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
