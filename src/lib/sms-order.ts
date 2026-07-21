/**
 * Isomorphic helpers for SMS orders — shared by the server pages and the client
 * workspace. The type import is erased at build time, so this file pulls no
 * server code into the browser bundle.
 */
import type { SmsOrderRow } from "@/lib/server/sms-service";

/**
 * Retail price per number, in rupiah. Flat, and deliberately decoupled from
 * SMSPool's wholesale price — that figure is still stored on `sms_order.cost`
 * for real accounting, but it is never shown in the UI.
 *
 * Change it here; nothing else hardcodes a price.
 */
export const SMS_PRICE_IDR = 5000;

/**
 * Whether the number can still be re-requested.
 *
 * SMSPool keeps a one-time number resendable for up to ~120 hours after the
 * order, so a delivered number stays useful for days — it is not spent by its
 * first code. Requires a delivered SMS, since /sms/resend refuses a number that
 * never received one.
 *
 * When SMSPool hasn't told us the window (older rows, or a failed
 * /sms/check_resend), this returns true and lets the provider be the one to
 * refuse — better than hiding an action that would have worked.
 */
export function isReusable(order: SmsOrderRow): boolean {
  if (!order.code) return false;
  if (order.resends_left === 0) return false;
  if (order.resend_expires_at == null) return true;
  return new Date(order.resend_expires_at).getTime() > Date.now();
}
