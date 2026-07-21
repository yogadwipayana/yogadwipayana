import { ApiError, fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import { redeemVoucher } from "@/lib/server/balance-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/** Redeem a voucher code and credit its rupiah value to the caller's wallet. */
export async function POST(request: Request) {
  try {
    const { user, supabase } = await requireUserWithClient();
    await checkRateLimit(
      ratelimits.balanceVoucher,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "voucher redemption",
    );

    const body = (await request.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const code = typeof body?.code === "string" ? body.code : "";
    if (!code) {
      throw new ApiError(400, "INVALID_CODE", "Voucher code is required.");
    }

    const result = await redeemVoucher(supabase, user.email, code);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
