// A coloured pill for an order, commission, withdrawal or member status. The
// words are the same as before (only the colour is new), so it reads clearly at
// a glance in a long table.
const tones = {
  good: "bg-mint/10 text-mint",
  warn: "bg-gold/10 text-gold-bright",
  bad: "bg-coral/10 text-coral",
  info: "bg-teal/10 text-teal",
};

const toneFor = {
  paid: "good", delivered: "good", approved: "good", active: "good", fulfilled: "good",
  pending: "warn", pending_payment: "warn", processing: "warn", payment_review: "warn", review: "warn",
  cancelled: "bad", refunded: "bad", reversed: "bad", rejected: "bad", suspended: "bad",
};

export default function StatusBadge({ status, label }) {
  const tone = tones[toneFor[status]] || "bg-navy-panel2 text-ink-dim";
  return (
    <span className={`badge capitalize ${tone}`}>
      {label ?? String(status).replaceAll("_", " ")}
    </span>
  );
}
