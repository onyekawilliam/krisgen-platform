import { useState } from "react";

const WHATSAPP_NUMBER = "2348035142589";

export default function Contact() {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [opened, setOpened] = useState(false);

  // There is no inbox behind this page, so the message is handed to WhatsApp
  // (prefilled) where the team actually answers, instead of being dropped.
  function handleSubmit(e) {
    e.preventDefault();
    const text = `Hello Krisgen, my name is ${form.name.trim()} (${form.phone.trim()}).

${form.message.trim()}`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    setOpened(true);
    setForm({ name: "", phone: "", message: "" });
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
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm py-2.5">
            WhatsApp us
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input className="input" placeholder="Your name" required maxLength={100} value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Phone number" required maxLength={40} value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <textarea className="input min-h-[100px]" placeholder="What can we help with?" required maxLength={1000} value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <button type="submit" className="btn-primary">Send on WhatsApp</button>
        <p className="text-ink-faint text-xs">This opens WhatsApp with your message ready to send.</p>
        {opened && <p className="text-teal text-sm">WhatsApp should have opened — press send there to reach us.</p>}
      </form>
    </div>
  );
}
