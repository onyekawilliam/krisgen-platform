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
    <div className="max-w-2xl mx-auto px-5 py-14">
      <h1 className="font-display text-3xl font-bold mb-8">Frequently asked questions</h1>
      <div className="flex flex-col gap-2">
        {faqs.map((f, i) => (
          <div key={f.q} className="card">
            <button
              className="w-full text-left font-display font-semibold flex justify-between items-center"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {f.q}
              <span className="text-ink-faint">{open === i ? "–" : "+"}</span>
            </button>
            {open === i && <p className="text-ink-dim text-sm mt-3">{f.a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
