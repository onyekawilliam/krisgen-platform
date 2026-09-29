import { useState } from "react";

export default function Contact() {
  const [sent, setSent] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    // In production, POST to a /api/contact endpoint or ticketing integration.
    setSent(true);
    e.target.reset();
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-14 grid md:grid-cols-2 gap-10">
      <div>
        <p className="text-teal text-sm font-semibold mb-2">Contact</p>
        <h1 className="font-display text-2xl font-bold mb-3">Talk to us</h1>
        <p className="text-ink-dim text-sm mb-5">
          Questions about a phone, an order, or the affiliate program — reach us directly.
        </p>
        <div className="font-mono text-xl text-gold-bright mb-4">08035142589</div>
        <div className="flex gap-3">
          <a href="tel:08035142589" className="btn-outline text-sm py-2.5">Call now</a>
          <a href="https://wa.me/2348035142589" target="_blank" rel="noopener noreferrer" className="btn-outline text-sm py-2.5">
            WhatsApp us
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="input" placeholder="Your name" required />
        <input className="input" placeholder="Phone number" required />
        <textarea className="input min-h-[100px]" placeholder="What can we help with?" required />
        <button type="submit" className="btn-primary">Send message</button>
        {sent && <p className="text-teal text-sm">Thanks — we'll get back to you shortly.</p>}
      </form>
    </div>
  );
}
