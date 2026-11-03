import LegalPage from "../../components/LegalPage";

const sections = [
  {
    heading: "Who we are",
    body: [
      "Krisgen Communications Ltd (\"Krisgen\", \"we\", \"us\") sells mobile phones to customers in Nigeria and runs a free referral programme. By creating an account, placing an order or using the referral programme you agree to these terms.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Registration is free. Give us accurate details and keep your password private; you are responsible for what happens on your account. One person should hold one account.",
      "We may suspend or close an account that breaks these terms, is used for fraud, or puts other customers or Krisgen at risk.",
    ],
  },
  {
    heading: "Buying a phone",
    body: [
      "Prices are in Nigerian naira and the price shown when you place your order is the price you pay. Stock is limited and is only reserved once your payment is confirmed.",
      "Your order is confirmed when Flutterwave confirms your payment to us. If an item turns out to be out of stock, or a price was shown by mistake, we may cancel the order and refund you in full.",
      "You must give a complete and correct delivery address and phone number. We are not responsible for delays caused by wrong or incomplete details.",
    ],
  },
  {
    heading: "Payments",
    body: [
      "Card, bank transfer and USSD payments are handled by Flutterwave. We never see or store your card details. We treat a payment as received only after we have verified it directly with Flutterwave.",
    ],
  },
  {
    heading: "The referral programme",
    body: [
      "The programme is free to join and nothing has to be bought to take part. It is not employment, a partnership or an investment, and we do not pay anyone for recruiting other members. Earnings come only from phones that are actually sold.",
      "When someone who signed up with your referral link buys a phone, you earn a commission worked out as a percentage of Krisgen's profit on that sale (selling price minus our cost price), never of the full price. If you were yourself referred by someone, they earn a smaller override on the same sale. It goes one level only: nothing is paid beyond that.",
      "The percentages are set by Krisgen and shown on your earnings page. We may change them for future sales; a commission you have already earned keeps the rate and amount it was calculated with.",
      "A new commission starts as pending. After we review it, it becomes approved and can be withdrawn. If the order is cancelled or refunded, its commissions are cancelled or reversed.",
      "You can ask to withdraw your approved balance to a Nigerian bank account in your own name. Withdrawals are checked and paid by us manually, so they are not instant. A withdrawal that has been paid cannot be reversed.",
      "We may withhold or reverse commissions, and close accounts, where we find fraud, such as fake or duplicate accounts, or buying phones through accounts you control to earn commission on your own purchases. We do not promise any level of earnings.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Do not misuse the site: no attempts to break into it or other accounts, to interfere with payments, to overload it, or to collect other people's information.",
    ],
  },
  {
    heading: "Our responsibility",
    body: [
      "We sell genuine devices and will put right a genuine fault as described on our refunds and cancellations page. Nothing in these terms limits any right you have under Nigerian consumer-protection law that cannot be limited. Beyond that, we are not liable for losses we could not reasonably have foreseen, or for interruptions to the site outside our control.",
    ],
  },
  {
    heading: "Changes and governing law",
    body: [
      "We may update these terms; the date at the top shows the latest version, and using the site after a change means you accept it. These terms are governed by the laws of the Federal Republic of Nigeria.",
    ],
  },
  {
    heading: "Contact",
    body: ["Questions about these terms: call or WhatsApp 08035142589, or use our contact page."],
  },
];

export default function Terms() {
  return <LegalPage title="Terms of use" sections={sections} />;
}
