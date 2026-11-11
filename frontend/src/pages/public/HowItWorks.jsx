import { Link } from "react-router-dom";

const steps = [
  { title: "Register free", body: "Give us your name and number. No fee, no purchase required." },
  { title: "Get your link", body: "A personal referral link is generated for your account immediately." },
  { title: "Share it", body: "Send it to people looking for a phone — WhatsApp, status, wherever." },
  { title: "Get paid", body: "Earn a share of the profit whenever a sale tied to your link goes through." },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <p className="eyebrow mb-3">Getting started</p>
      <h1 className="page-title mb-10 md:text-4xl">How it works</h1>
      <ol className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.title} className="card p-6">
            <div className="font-mono text-sm text-gold">{String(i + 1).padStart(2, "0")}</div>
            <h2 className="mb-2 mt-3 font-display text-lg font-semibold">{s.title}</h2>
            <p className="text-sm leading-relaxed text-ink-dim">{s.body}</p>
          </li>
        ))}
      </ol>
      <Link to="/register" className="btn-primary mt-10">Join free</Link>
    </div>
  );
}
