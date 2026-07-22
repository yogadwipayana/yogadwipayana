import { fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import { getBalance } from "@/lib/server/balance-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { getAvailability } from "@/lib/server/sms-service";

export const runtime = "nodejs";

/**
 * Everything the order panel re-reads after an action: provider state plus the
 * wallet, which every order moves.
 *
 * Throttled because `getAvailability` fans out to three SMSPool endpoints, so a
 * held-down refresh button multiplies straight through to the provider.
 */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUserWithClient();
    await checkRateLimit(
      ratelimits.smsStatus,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "SMS status",
    );

    const [availability, balanceIdr] = await Promise.all([
      getAvailability(),
      getBalance(supabase, user.id),
    ]);
    return ok({ availability, balanceIdr });
  } catch (err) {
    return fail(err);
  }
}
