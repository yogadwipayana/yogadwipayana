import { fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { createOrder, refreshOrders } from "@/lib/server/sms-service";

export const runtime = "nodejs";

/**
 * The user's orders, reconciled against SMSPool first so a code that arrived
 * since the last call shows up. This is the endpoint the dashboard polls.
 */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUserWithClient();
    await checkRateLimit(
      ratelimits.smsPoll,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "SMS polling",
    );

    const orders = await refreshOrders(supabase, user.id);
    return ok({ orders });
  } catch (err) {
    return fail(err);
  }
}

/** Rent one number for OpenAI/Codex verification. */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUserWithClient();
    await checkRateLimit(
      ratelimits.smsOrder,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "SMS ordering",
    );

    const order = await createOrder(supabase, user.id);
    return ok({ order }, 201);
  } catch (err) {
    return fail(err);
  }
}
