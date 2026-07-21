import { fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import { getBalance } from "@/lib/server/balance-service";
import { getAvailability } from "@/lib/server/sms-service";

export const runtime = "nodejs";

/**
 * Everything the order panel re-reads after an action: provider state plus the
 * wallet, which every order moves.
 */
export async function GET() {
  try {
    const { user, supabase } = await requireUserWithClient();
    const [availability, balanceIdr] = await Promise.all([
      getAvailability(),
      getBalance(supabase, user.id),
    ]);
    return ok({ availability, balanceIdr });
  } catch (err) {
    return fail(err);
  }
}
