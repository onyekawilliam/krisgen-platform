import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-navy-line mt-16">
      <div className="max-w-6xl mx-auto px-5 py-8">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <div className="font-display font-bold">Krisgen Communications Ltd</div>
            <div className="text-ink-faint text-sm mt-1">Genuine phones, dealer prices, honest commissions.</div>
          </div>
          <div className="text-ink-dim text-sm text-right">
            08035142589
            <br />
            Call &amp; WhatsApp
          </div>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1 mt-5 text-sm text-ink-dim">
          <Link to="/terms" className="hover:text-ink">Terms of use</Link>
          <Link to="/privacy" className="hover:text-ink">Privacy policy</Link>
          <Link to="/refunds" className="hover:text-ink">Refunds and cancellations</Link>
          <Link to="/faq" className="hover:text-ink">FAQ</Link>
        </nav>
        <div className="mt-5 pt-4 border-t border-navy-line text-ink-faint text-xs max-w-3xl">
          Registration is free. Affiliate commissions are paid only on completed phone sales and calculated from
          Krisgen's profit on each sale — never on recruiting other affiliates.
        </div>
      </div>
    </footer>
  );
}
