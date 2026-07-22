import { timingSafeEqual } from "node:crypto";

import { ApiError, fail, ok } from "@/lib/server/api-response";
import { reconcileExpiredOrders } from "@/lib/server/sms-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Settle SMS orders that lapsed with nobody watching.
 *
 * Refunds otherwise only happen while a dashboard is polling, so a user who
 * closes the tab on a number that never receives its code has their money held
 * indefinitely. Point a scheduler at this every few minutes.
 *
 * Not a user route: there is no session, so the only thing standing in front of
 * it is `CRON_SECRET`. Without that variable set the endpoint stays closed
 * rather than falling open.
 */
export async function GET(request: Request) {
  try {
    authorize(request);
    const summary = await reconcileExpiredOrders();
    return ok(summary);
  } catch (err) {
    return fail(err);
  }
}

function authorize(request: Request): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    throw new ApiError(503, "CRON_NOT_CONFIGURED", "Reconciliation is disabled.");
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (!matches(presented, secret)) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }
}

/** Constant-time comparison, so the secret can't be recovered a byte at a time. */
function matches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
