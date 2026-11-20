import { useEffect, useState } from "react";

const CLOUDINARY_VIDEO = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)\.[a-z0-9]+$/i;
const HAS_TRANSFORMATION = /^[a-z]{1,3}_[^/]*\//;

// Cloudinary can re-encode a video as a smaller MP4 that plays in every browser
// (q_auto), which saves customers' data. The original is kept as a fallback in case
// that copy is not ready yet. Other links are played as they are.
export function videoSources(url) {
  const match = typeof url === "string" && url.match(CLOUDINARY_VIDEO);
  if (!match || HAS_TRANSFORMATION.test(match[2])) return [url];
  return [`${match[1]}q_auto/${match[2]}.mp4`, url];
}

// A still from the start of the video, so the page shows a picture before it plays.
export function videoPoster(url, width = 1200) {
  const match = typeof url === "string" && url.match(CLOUDINARY_VIDEO);
  if (!match || HAS_TRANSFORMATION.test(match[2])) return undefined;
  return `${match[1]}so_0,w_${width},c_limit,q_auto/${match[2]}.jpg`;
}

// Plays a phone video. It only downloads when the customer presses play.
export default function ProductVideo({ src, title, className = "" }) {
  return (
    <video
      key={src}
      controls
      playsInline
      preload="none"
      poster={videoPoster(src)}
      aria-label={title}
      className={`bg-black ${className}`}
    >
      {videoSources(src).map((s) => <source key={s} src={s} type={s.includes("/q_auto/") ? "video/mp4" : undefined} />)}
      Your browser cannot play this video.
    </video>
  );
}

// A small still with a play sign, for thumbnails.
export function VideoThumb({ src, className = "" }) {
  const poster = videoPoster(src, 300);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className={`relative flex items-center justify-center bg-brand ${className}`}>
      {poster && !failed && <img src={poster} alt="" loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />}
      <span className="absolute flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>
    </span>
  );
}
