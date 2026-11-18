import { useCallback, useEffect, useId, useRef, useState } from "react";

// The site's own "Are you sure?" box, used instead of the browser's pop-up.
//   const [confirm, confirmDialog] = useConfirm();
//   if (await confirm({ title, message, confirmLabel, danger: true })) { ... }
// and render {confirmDialog} somewhere in the page.
export function useConfirm() {
  const [request, setRequest] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), []);
  const answer = (yes) => {
    request?.resolve(yes);
    setRequest(null);
  };
  return [confirm, request && <ConfirmDialog {...request} onAnswer={answer} />];
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", danger = false, onAnswer }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape and a click outside the box both mean "no".
      onCancel={(e) => { e.preventDefault(); onAnswer(false); }}
      onClick={(e) => { if (e.target === ref.current) onAnswer(false); }}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-navy-line bg-navy-panel p-0 text-ink shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 id={titleId} className="font-display text-lg font-bold">{title}</h2>
        {message && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-dim">{message}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {/* The safe choice has the focus, so pressing Enter by habit does no harm. */}
          <button type="button" autoFocus onClick={() => onAnswer(false)} className="btn-outline px-5 py-2.5 text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(true)}
            className={danger
              ? "inline-flex items-center justify-center rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 dark:text-brand"
              : "btn-primary px-5 py-2.5 text-sm"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
