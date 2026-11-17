import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import ProductImage from "./ProductImage";

export const MAX_PHOTOS = 5;
const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// Add, remove and reorder the photos of a phone (one to five).
//  - A phone that already exists saves each change straight away.
//  - A new phone queues its chosen photos; they upload after the phone is saved.
export default function PhotoManager({ productId, name, photos, onPhotosChange, queued, onQueuedChange }) {
  const isNew = productId === "new";
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const queuedPreviews = useMemo(() => queued.map((file) => URL.createObjectURL(file)), [queued]);
  useEffect(() => () => queuedPreviews.forEach((url) => URL.revokeObjectURL(url)), [queuedPreviews]);

  const used = isNew ? queued.length : photos.length;
  const remaining = MAX_PHOTOS - used;

  function problemWith(file) {
    if (!allowedTypes.includes(file.type)) return `${file.name}: choose a JPEG, PNG, WebP, GIF or AVIF image.`;
    if (file.size > 5 * 1024 * 1024) return `${file.name}: photos must be 5 MB or smaller.`;
    return null;
  }

  async function addFiles(event) {
    const chosen = [...(event.target.files || [])];
    event.target.value = "";
    setError("");
    setNotice("");
    if (!chosen.length) return;
    if (remaining <= 0) {
      setError(`A phone can have at most ${MAX_PHOTOS} photos. Remove one first.`);
      return;
    }
    const problems = [];
    const valid = [];
    for (const file of chosen) {
      const problem = problemWith(file);
      if (problem) problems.push(problem);
      else valid.push(file);
    }
    const accepted = valid.slice(0, remaining);
    if (valid.length > accepted.length) {
      problems.push(`Only ${remaining} more photo${remaining === 1 ? " fits" : "s fit"}, so the extra ${valid.length - accepted.length} ${valid.length - accepted.length === 1 ? "was" : "were"} skipped.`);
    }
    if (problems.length) setError(problems.join(" "));
    if (!accepted.length) return;

    if (isNew) {
      onQueuedChange([...queued, ...accepted]);
      setNotice("Photos selected. They upload when you save the phone.");
      return;
    }

    setBusy(true);
    let latest = photos;
    try {
      for (const [i, file] of accepted.entries()) {
        setNotice(`Uploading photo ${i + 1} of ${accepted.length}…`);
        const data = new FormData();
        data.append("image", file);
        const response = await api.post(`/products/admin/${productId}/images`, data);
        latest = response.data.data.images || [];
        onPhotosChange(latest);
      }
      setNotice(accepted.length === 1 ? "Photo added." : `${accepted.length} photos added.`);
    } catch (err) {
      setError(err.response?.data?.message || "A photo could not be uploaded. Please try again.");
      setNotice("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(index) {
    setError("");
    setNotice("");
    if (isNew) {
      onQueuedChange(queued.filter((_, i) => i !== index));
      return;
    }
    setBusy(true);
    try {
      const response = await api.delete(`/products/admin/${productId}/images/${index}`);
      onPhotosChange(response.data.data.images || []);
      setNotice(response.data.warning || "Photo removed.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  async function makeMain(index) {
    setError("");
    setNotice("");
    if (isNew) {
      const next = [...queued];
      next.unshift(...next.splice(index, 1));
      onQueuedChange(next);
      return;
    }
    setBusy(true);
    try {
      const response = await api.post(`/products/admin/${productId}/images/${index}/primary`);
      onPhotosChange(response.data.data.images || []);
      setNotice("Main photo changed.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not change the main photo.");
    } finally {
      setBusy(false);
    }
  }

  const tiles = isNew
    ? queued.map((file, i) => ({ key: file.name + i, src: queuedPreviews[i], pending: true }))
    : photos.map((url, i) => ({ key: url, src: url, pending: false }));

  return (
    <div className="col-span-2">
      <div className="flex items-baseline justify-between">
        <span className="label mb-0">Photos</span>
        <span className="text-xs text-ink-faint">{used} of {MAX_PHOTOS}</span>
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        Add 1 to {MAX_PHOTOS} photos. The first one is the main photo customers see in the shop. JPEG, PNG, WebP, GIF or AVIF, each up to 5 MB.
      </p>

      {tiles.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {tiles.map((tile, i) => (
            <li key={tile.key} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-xl border border-navy-line bg-navy-panel2">
                <ProductImage src={tile.src} alt={`${name || "Phone"} photo ${i + 1}`} width={300} className="h-full w-full object-contain" />
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-brand">Main</span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {i > 0 && (
                  <button type="button" disabled={busy} onClick={() => makeMain(i)} className="font-medium text-teal hover:underline disabled:opacity-50">
                    Make main
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => remove(i)} className="font-medium text-coral hover:underline disabled:opacity-50">
                  Remove
                </button>
              </div>
              {tile.pending && <span className="text-[11px] text-ink-faint">Uploads on save</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <label htmlFor="product-photos" className="sr-only">Add photos</label>
        <input
          id="product-photos"
          type="file"
          multiple
          accept={allowedTypes.join(",")}
          disabled={busy || remaining <= 0}
          onChange={addFiles}
          className="block w-full text-sm text-ink-dim file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-gold file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        />
        {remaining <= 0 && <p className="mt-1.5 text-xs text-ink-faint">That is all {MAX_PHOTOS}. Remove one to add a different photo.</p>}
      </div>

      {notice && <p className="mt-2 text-xs text-teal" role="status">{notice}</p>}
      {error && <p className="mt-2 text-xs text-coral" role="alert">{error}</p>}
    </div>
  );
}
