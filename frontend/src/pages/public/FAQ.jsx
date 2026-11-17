import { useState } from "react";

const faqs = [
  { q: "Does it cost anything to register?", a: "No. Registration is completely free — there is no sign-up fee and nothing you must buy to join." },
  { q: "How is my commission calculated?", a: "From Krisgen's profit on the sale (selling price minus cost price), not from the phone's full price. Your dashboard shows the exact breakdown for every commission." },
  { q: "How many levels can I earn from?", a: "One. If someone you referred makes a sale, you earn an override on that sale. Their own referrals' sales don't pay you anything — there's no multi-level structure." },
  { q: "When do I get paid?", a: "Commissions move from pending to approved after admin review, and you can request a withdrawal once a commission is approved." },
  { q: "Can I see the phone's cost price?", a: "No — cost price is only visible to Krisgen administrators. You always see the selling price and, for your own commissions, the exact profit and rate used to calculate your earnings." },
];

export default function FAQ() {
  const [open, setOpen] = useState(null);

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <p className="eyebrow mb-3">Help</p>
      <h1 className="page-title mb-8 md:text-4xl">Frequently asked questions</h1>
      <div className="flex flex-col gap-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="card p-0">
              <h2>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display font-semibold"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${i}`}
                >
                  {f.q}
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" className={`shrink-0 text-gold-bright transition-transform ${isOpen ? "rotate-45" : ""}`} aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </h2>
              {isOpen && (
                <p id={`faq-${i}`} className="px-5 pb-5 text-sm leading-relaxed text-ink-dim">{f.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
