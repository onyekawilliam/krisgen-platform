import LegalPage from "../../components/LegalPage";

const sections = [
  {
    heading: "What we collect",
    body: [
      "Account details: your name, email address, phone number and a password (we keep only a scrambled version of it, never the password itself).",
      "Order details: the phones you buy, the delivery name, phone, address, city and state you give us, and the status and payment reference of each order.",
      "Referral and earnings details: who referred you, who you referred, the commissions you earn and, if you request a withdrawal, the bank name, account number and account name you enter.",
      "Technical details: our servers keep ordinary request logs (such as IP address and time), and your browser keeps one sign-in cookie.",
    ],
  },
  {
    heading: "Why we use it",
    body: [
      "To create your account and sign you in; to take payment for and deliver your orders; to work out, review and pay referral commissions; to prevent fraud and misuse; to answer your questions; and to meet our legal obligations. We do not sell your information and we do not use it for advertising.",
    ],
  },
  {
    heading: "Who else handles it",
    body: [
      "Flutterwave processes your payment; card details go to them and not to us. MongoDB Atlas stores our database, Render runs our server and Vercel serves our website. Cloudinary stores product photos only. If you contact us on WhatsApp, WhatsApp handles that conversation under its own policy.",
      "We share information with authorities only where the law requires it. Within the programme, a member can see the name and email of people they referred and the commissions they earned from them, and nothing about the products' cost prices.",
    ],
  },
  {
    heading: "The sign-in cookie",
    body: [
      "We use one cookie, set when you log in, to keep you signed in. It is marked HTTP-only so scripts on a page cannot read it, and it expires after seven days or when you log out. We do not use advertising or tracking cookies.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "We keep account information while your account is open. Order, payment and commission records are kept for as long as needed for accounting, tax and dispute purposes, even after an account is closed.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Under the Nigeria Data Protection Act 2023 you may ask to see the personal data we hold about you, to have it corrected, to have it deleted where we no longer need it, to object to or restrict certain uses, and to withdraw consent. Contact us and we will respond within a reasonable time. You may also complain to the Nigeria Data Protection Commission.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Passwords are stored only in scrambled form, connections to the site are encrypted, and access to admin tools is restricted. No system is perfectly secure, so please choose a strong password and tell us at once if you think your account was accessed by someone else.",
    ],
  },
  {
    heading: "Contact and changes",
    body: [
      "To use your rights or ask a question, call or WhatsApp 08035142589, or use our contact page. We may update this policy and will change the date at the top when we do.",
    ],
  },
];

export default function Privacy() {
  return <LegalPage title="Privacy policy" sections={sections} />;
}
