import { Link } from "react-router-dom";

// Set to false once a lawyer (or you, with the facts checked) has approved the
// wording of the Terms, Privacy and Refund pages. While true, every legal page
// shows a notice that it is awaiting review.
export const LEGAL_PAGES_ARE_DRAFT = true;

export const LEGAL_LAST_UPDATED = "2 November 2026";

export default function LegalPage({ title, intro, sections }) {
  return (
    <div className="max-w-2xl mx-auto px-5 py-14">
      <p className="text-teal text-sm font-semibold mb-2">Legal</p>
      <h1 className="font-display text-3xl font-bold mb-2">{title}</h1>
      <p className="text-ink-faint text-xs mb-6">Last updated {LEGAL_LAST_UPDATED}</p>

      {LEGAL_PAGES_ARE_DRAFT && (
        <p role="note" className="card text-sm text-gold-bright mb-8">
          This page is a draft awaiting legal review and may change.
        </p>
      )}

      {intro && <p className="text-ink-dim mb-8">{intro}</p>}

      <div className="flex flex-col gap-7">
        {sections.map((section, index) => (
          <section key={section.heading}>
            <h2 className="font-display font-semibold text-lg mb-2">{index + 1}. {section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="text-ink-dim text-sm mb-2.5 leading-relaxed">{paragraph}</p>
            ))}
          </section>
        ))}
      </div>

      <nav aria-label="Other legal pages" className="flex flex-wrap gap-4 text-sm mt-12 pt-6 border-t border-navy-line">
        <Link to="/terms" className="text-teal">Terms of use</Link>
        <Link to="/privacy" className="text-teal">Privacy policy</Link>
        <Link to="/refunds" className="text-teal">Refunds and cancellations</Link>
        <Link to="/contact" className="text-teal">Contact us</Link>
      </nav>
    </div>
  );
}
