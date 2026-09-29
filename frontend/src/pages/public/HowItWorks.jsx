const steps = [
  { title: "Register free", body: "Give us your name and number. No fee, no purchase required." },
  { title: "Get your link", body: "A personal referral link is generated for your account immediately." },
  { title: "Share it", body: "Send it to people looking for a phone — WhatsApp, status, wherever." },
  { title: "Get paid", body: "Earn a share of the profit whenever a sale tied to your link goes through." },
];

export default function HowItWorks() {
  return (
    <div className="max-w-3xl mx-auto px-5 py-14">
      <p className="text-teal text-sm font-semibold mb-2">Getting started</p>
      <h1 className="font-display text-3xl font-bold mb-8">How it works</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {steps.map((s, i) => (
          <div key={s.title} className="border-l-2 border-gold pl-4">
            <div className="font-mono text-gold-bright text-xs">{String(i + 1).padStart(2, "0")}</div>
            <h3 className="font-display font-semibold mt-1.5 mb-1">{s.title}</h3>
            <p className="text-ink-dim text-sm">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
