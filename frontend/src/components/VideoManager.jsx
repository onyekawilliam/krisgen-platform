import { useState } from "react";
import api from "../api/axios";
import ProductVideo from "./ProductVideo";

export const MAX_VIDEOS = 3;
const MAX_VIDEO_MB = 50;
const allowedTypes = ["video/mp4", "video/quicktime", "video/webm"];

// Add or remove the short videos of a phone (up to three). Videos save straight
// away, so a brand-new phone has to be saved before videos can be added.
export default function VideoManager({ productId, name, videos, onVideosChange }) {
  const isNew = productId === "new";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const remaining = MAX_VIDEOS - videos.length;

  function problemWith(file) {
    if (!allowedTypes.includes(file.type)) return `${file.name}: choose an MP4, MOV or WebM video.`;
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) return `${file.name}: videos must be ${MAX_VIDEO_MB} MB or smaller.`;
    return null;
  }

  async function addFiles(event) {
    const chosen = [...(event.target.files || [])];
    event.target.value = "";
    setError("");
    setNotice("");
    if (!chosen.length) return;
    const problems = [];
    const valid = [];
    for (const file of chosen) {
      const problem = problemWith(file);
      if (problem) problems.push(problem);
      else valid.push(file);
    }
    const accepted = valid.slice(0, Math.max(remaining, 0));
    if (valid.length > accepted.length) {
      problems.push(`Only ${remaining} more video${remaining === 1 ? " fits" : "s fit"}, so the extra ${valid.length - accepted.length} ${valid.length - accepted.length === 1 ? "was" : "were"} skipped.`);
    }
    if (problems.length) setError(problems.join(" "));
    if (!accepted.length) return;

    setBusy(true);
    try {
      for (const [i, file] of accepted.entries()) {
        const which = accepted.length > 1 ? ` ${i + 1} of ${accepted.length}` : "";
        setNotice(`Uploading video${which}…`);
        const data = new FormData();
        data.append("video", file);
        const response = await api.post(`/products/admin/${productId}/videos`, data, {
          onUploadProgress: (e) => {
            if (e.total) setNotice(`Uploading video${which}… ${Math.round((e.loaded / e.total) * 100)}%`);
          },
        });
        onVideosChange(response.data.data.videos || []);
      }
      setNotice(accepted.length === 1 ? "Video added." : `${accepted.length} videos added.`);
    } catch (err) {
      setError(err.response?.data?.message || "A video could not be uploaded. Please try again.");
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(index) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await api.delete(`/products/admin/${productId}/videos/${index}`);
      onVideosChange(response.data.data.videos || []);
      setNotice(response.data.warning || "Video removed.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the video.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="label mb-0">Videos</span>
        <span className="text-xs text-ink-faint">{videos.length} of {MAX_VIDEOS}</span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Optional. Up to {MAX_VIDEOS} short videos, shown on the phone's page after the photos. MP4, MOV or WebM, each up to {MAX_VIDEO_MB} MB.
        Short clips (under a minute) load faster on customers' data.
      </p>

      {isNew ? (
        <p className="mt-3 rounded-xl bg-navy-panel2 px-3 py-2.5 text-xs text-ink-dim">Save the phone first, then edit it to add videos.</p>
      ) : (
        <>
          {videos.length > 0 && (
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {videos.map((url, i) => (
                <li key={url} className="flex flex-col gap-1.5">
                  <ProductVideo src={url} title={`${name || "Phone"} video ${i + 1}`} className="aspect-video w-full rounded-xl object-contain" />
                  <button type="button" disabled={busy} onClick={() => remove(i)} className="self-start text-xs font-medium text-coral hover:underline disabled:opacity-50">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <label htmlFor="product-videos" className="sr-only">Add videos</label>
            <input
              id="product-videos"
              type="file"
              multiple
              accept={allowedTypes.join(",")}
              disabled={busy || remaining <= 0}
              onChange={addFiles}
              className="block w-full text-sm text-ink-dim file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand disabled:cursor-not-allowed disabled:opacity-50"
            />
            {remaining <= 0 && <p className="mt-1.5 text-xs text-ink-faint">That is all {MAX_VIDEOS}. Remove one to add a different video.</p>}
          </div>
        </>
      )}

      {notice && <p className="mt-2 text-xs text-teal" role="status">{notice}</p>}
      {error && <p className="mt-2 text-xs text-coral" role="alert">{error}</p>}
    </div>
  );
}
