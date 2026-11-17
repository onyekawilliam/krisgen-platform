import { Link } from "react-router-dom";

const footerLink = "text-sm text-brand-dim transition-colors hover:text-brand-text";
const heading = "mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand-dim/80";

export default function Footer() {
  return (
    <footer className="mt-24 bg-brand text-brand-text">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-display text-lg font-bold">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold font-display text-sm font-bold text-brand">KC</span>
              Krisgen Communications Ltd
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-brand-dim">
              Genuine phones, dealer prices, honest commissions.
            </p>
            <a
              href="https://wa.me/2348035142589"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-brand transition hover:brightness-95"
            >
              Chat on WhatsApp
            </a>
          </div>

          <nav aria-label="Shop" className="flex flex-col gap-2.5">
            <h2 className={heading}>Shop</h2>
            <Link to="/shop" className={footerLink}>All phones</Link>
            <Link to="/affiliate" className={footerLink}>Affiliate program</Link>
            <Link to="/how-it-works" className={footerLink}>How it works</Link>
            <Link to="/faq" className={footerLink}>FAQ</Link>
          </nav>

          <nav aria-label="Legal" className="flex flex-col gap-2.5">
            <h2 className={heading}>Legal</h2>
            <Link to="/terms" className={footerLink}>Terms of use</Link>
            <Link to="/privacy" className={footerLink}>Privacy policy</Link>
            <Link to="/refunds" className={footerLink}>Refunds and cancellations</Link>
          </nav>

          <div className="flex flex-col gap-2.5">
            <h2 className={heading}>Talk to us</h2>
            <a href="tel:08035142589" className="font-mono text-lg text-gold hover:brightness-110">08035142589</a>
            <span className="text-sm text-brand-dim">Call &amp; WhatsApp</span>
            <Link to="/contact" className={footerLink}>Contact page</Link>
          </div>
        </div>

        <div className="mt-12 border-t border-brand-line pt-6 text-xs leading-relaxed text-brand-dim">
          Registration is free. Affiliate commissions are paid only on completed phone sales and calculated from
          Krisgen's profit on each sale, never on recruiting other affiliates.
        </div>
      </div>
    </footer>
  );
}
