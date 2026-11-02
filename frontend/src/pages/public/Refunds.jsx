import LegalPage from "../../components/LegalPage";

const sections = [
  {
    heading: "Before you pay",
    body: [
      "An order that is still waiting for payment can be cancelled at any time from your My orders page, and nothing is charged.",
    ],
  },
  {
    heading: "After you pay, before delivery",
    body: [
      "If you change your mind after paying but before your phone is delivered, contact us as soon as you can by phone or WhatsApp. If we have not yet dispatched it, we will cancel the order and refund the full amount to the original payment method.",
      "If we cannot supply your phone (for example it is out of stock) we will cancel the order and refund you in full. Refunds are sent back through Flutterwave and can take a few working days to reach your bank.",
    ],
  },
  {
    heading: "If something is wrong when it arrives",
    body: [
      "Check your phone when it is delivered. If it is not what you ordered, is damaged, or has a fault, contact us straight away with your order number so we can put it right by repair, replacement or refund, as appropriate. Faults covered by the manufacturer's warranty are handled under that warranty.",
    ],
  },
  {
    heading: "Referral commissions",
    body: [
      "When an order is cancelled or refunded, the referral commissions on it are cancelled or reversed too.",
    ],
  },
  {
    heading: "How to reach us",
    body: ["Call or WhatsApp 08035142589 and quote your order number, or use our contact page."],
  },
];

export default function Refunds() {
  return <LegalPage title="Refunds and cancellations" sections={sections} />;
}
