/**
 * Where buyers order vouchers, plans and accounts — every order goes through
 * WhatsApp, with a prefilled message naming the product.
 * Isomorphic — safe to import from server components and the browser alike.
 */

/** Order line in international format without "+" (0878-8964-0714). */
const WHATSAPP_NUMBER = "6287889640714";

/** wa.me chat link with a prefilled order message for `product`. */
export function whatsappOrderUrl(product: string): string {
  const text = `Halo, saya mau order ${product}.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** AI Router credit voucher, redeemed in the dashboard to top up AI credit. */
export const AI_VOUCHER_URL = whatsappOrderUrl("voucher kredit AI Router");

/** yogathedev Router API — the unlimited plans checked in /console. */
export const ROUTER_API_URL = whatsappOrderUrl("Router API (unlimited plan)");

/** SMS balance voucher, redeemed in the dashboard to top up the wallet. */
export const SMS_VOUCHER_URL = whatsappOrderUrl("voucher saldo SMS Verification");
