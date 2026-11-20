import { useState } from "react";
import { SHOP_PHONE, SHOP_WHATSAPP_DISPLAY, whatsappUrl, BUSINESS_ADDRESS } from "../../config";

export default function Contact() {
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [opened, setOpened] = useState(false);

  // There is no inbox behind this page, so the message is handed to WhatsApp
  // (prefilled) where the team actually answers, instead of being dropped.
  function handleSubmit(e) {
    e.preventDefault();
    const text = `Hello Krisgen, my name is ${form.name.trim()} (${form.phone.trim()}).

${form.message.trim()}`;
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
    setOpened(true);
    setForm({ name: "", phone: "", message: "" });
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-5 py-14 md:grid-cols-2 md:gap-14">
      <div>
        <p className="eyebrow mb-3">Contact</p>
        <h1 className="page-title mb-3 md:text-4xl">Talk to us</h1>
        <p className="mb-6 text-ink-dim">
          Questions about a phone, an order, or the affiliate program — reach us directly.
        </p>
        <dl className="mb-5 grid gap-3">
          <div>
            <dt className="text-sm text-ink-dim">Call</dt>
            <dd className="font-mono text-2xl text-gold-bright">{SHOP_PHONE}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-dim">WhatsApp</dt>
            <dd className="font-mono text-2xl text-gold-bright">{SHOP_WHATSAPP_DISPLAY}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-dim">Visit the shop</dt>
            <dd className="text-ink">{BUSINESS_ADDRESS}</dd>
          </div>
        </dl>
        <div className="flex gap-3">
          <a href={`tel:${SHOP_PHONE}`} className="btn-outline px-5 py-2.5 text-sm">Call now</a>
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer" className="btn-outline px-5 py-2.5 text-sm">
            WhatsApp us
          </a>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card flex flex-col gap-3 p-6 md:p-7">
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
