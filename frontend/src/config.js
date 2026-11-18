// Shop-wide settings read from the build.

// Online card, transfer and USSD payment only works once Flutterwave has approved
// the business and its public key is set (VITE_FLW_PUBLIC_KEY in Vercel). Until
// then the shop takes orders by phone and WhatsApp instead of showing a Buy
// button that cannot work, and switches itself to online payment when the key appears.
export const onlinePayments = Boolean(import.meta.env.VITE_FLW_PUBLIC_KEY);

// Calls go to SHOP_PHONE; WhatsApp is a separate line.
export const SHOP_PHONE = "08035142589";
export const SHOP_WHATSAPP_DISPLAY = "07031548095";
export const SHOP_WHATSAPP = "2347031548095"; // international form for wa.me links
export const whatsappUrl = (text) =>
  `https://wa.me/${SHOP_WHATSAPP}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
