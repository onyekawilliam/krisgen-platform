import { Link } from "react-router-dom";

const footerLink = "text-sm text-ink-dim transition-colors hover:text-ink";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-navy-line bg-navy-panel/40">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-display font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-[13px] font-bold text-navy-deep">KC</span>
              Krisgen Communications Ltd
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-dim">
              Genuine phones, dealer prices, honest commissions.
            </p>
          </div>

          <nav aria-label="Shop" className="flex flex-col gap-2.5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Shop</h2>
            <Link to="/shop" className={footerLink}>All phones</Link>
            <Link to="/affiliate" className={footerLink}>Affiliate program</Link>
            <Link to="/how-it-works" className={footerLink}>How it works</Link>
            <Link to="/faq" className={footerLink}>FAQ</Link>
          </nav>

          <nav aria-label="Legal" className="flex flex-col gap-2.5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Legal</h2>
            <Link to="/terms" className={footerLink}>Terms of use</Link>
            <Link to="/privacy" className={footerLink}>Privacy policy</Link>
            <Link to="/refunds" className={footerLink}>Refunds and cancellations</Link>
          </nav>

          <div className="flex flex-col gap-2.5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Talk to us</h2>
            <a href="tel:08035142589" className="font-mono text-lg text-gold-bright hover:text-gold">08035142589</a>
            <span className="text-sm text-ink-dim">Call &amp; WhatsApp</span>
            <Link to="/contact" className={footerLink}>Contact page</Link>
          </div>
        </div>

        <div className="mt-10 border-t border-navy-line pt-5 text-xs leading-relaxed text-ink-faint">
          Registration is free. Affiliate commissions are paid only on completed phone sales and calculated from
          Krisgen's profit on each sale, never on recruiting other affiliates.
        </div>
      </div>
    </footer>
  );
}
