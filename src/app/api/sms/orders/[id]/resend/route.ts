import { fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { resendOrder } from "@/lib/server/sms-service";

export const runtime = "nodejs";

/** Ask SMSPool to request the number again (only works after a first SMS). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, supabase } = await requireUserWithClient();
    await checkRateLimit(
      ratelimits.smsOrder,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "SMS resend",
    );

    const { id } = await params;
    const result = await resendOrder(supabase, user.id, id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
