/**
 * Voucher sales and top-ups are handled over WhatsApp.
 * Isomorphic — safe to import from server components and the browser alike.
 */

const WHATSAPP_NUMBER = "6287889640714";

/** A wa.me link that opens a chat with the given message prefilled. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Order a wallet voucher for the SMS OTP tool. */
export const SMS_VOUCHER_WHATSAPP_URL = whatsappUrl(
  "Hi, I want to buy a balance voucher for the SMS OTP tool — clicked from the balance dashboard.",
);

/** Order a credit voucher for the AI Router. */
export const AI_VOUCHER_WHATSAPP_URL = whatsappUrl(
  "Hi, I want to buy an AI Router credit voucher.",
);

/** Order an unlimited Router API plan (API Model Frontier). */
export const ROUTER_API_WHATSAPP_URL = whatsappUrl(
  "Hi, I want to order a Router API plan (API Model Frontier).",
);
