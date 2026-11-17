// Shop-wide settings read from the build.

// Online card, transfer and USSD payment only works once Flutterwave has approved
// the business and its public key is set (VITE_FLW_PUBLIC_KEY in Vercel). Until
// then the shop takes orders by phone and WhatsApp instead of showing a Buy
// button that cannot work, and switches itself to online payment when the key appears.
export const onlinePayments = Boolean(import.meta.env.VITE_FLW_PUBLIC_KEY);

export const SHOP_PHONE = "08035142589";
export const SHOP_WHATSAPP = "2348035142589";
