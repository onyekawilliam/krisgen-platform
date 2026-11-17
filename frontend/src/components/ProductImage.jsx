import { useEffect, useState } from "react";

// A stable colour for each phone name, so a shop full of phones without photos
// still has variety instead of one grey tile repeated.
function hueFor(text) {
  // FNV-1a: similar names still land on well-separated colours.
  let hash = 2166136261;
  for (const ch of String(text)) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (hash >>> 16) % 360;
}

// Shows the product photo, or a neat phone illustration with the model name when there is no photo yet.
// The tint follows the light/dark theme through the --ph-* variables in index.css.
export default function ProductImage({ src, alt, className = "" }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    const hue = hueFor(alt);
    return (
      <div
        role="img"
        aria-label={`${alt} (photo coming soon)`}
        className={`flex flex-col items-center justify-center gap-[6%] px-4 text-ink-dim ${className}`}
        style={{
          background: `radial-gradient(circle at 50% 38%, hsl(${hue} 60% var(--ph-1)) 0%, hsl(${hue} 50% var(--ph-2)) 58%, hsl(${hue} 30% var(--ph-3)) 100%)`,
        }}
      >
        <div
          className="relative aspect-[1/2] h-[52%] max-h-56 rounded-[18%/9%] border-[3px] border-brand-line bg-brand shadow-lift"
          aria-hidden="true"
        >
          <div
            className="absolute inset-[5%] rounded-[16%/8%]"
            style={{ background: `linear-gradient(160deg, hsl(${hue} 75% 62%), hsl(${(hue + 40) % 360} 65% 38%) 60%, hsl(${(hue + 80) % 360} 55% 18%))` }}
          />
          <div className="absolute left-1/2 top-[3.5%] h-[2.5%] w-[28%] -translate-x-1/2 rounded-full bg-brand" />
        </div>
        <span className="line-clamp-2 text-center text-xs font-medium">{alt}</span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={className} />;
}
