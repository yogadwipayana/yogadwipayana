import { fail, ok } from "@/lib/server/api-response";
import { requireUserWithClient } from "@/lib/server/auth-session";
import { getBalance, listTransactions } from "@/lib/server/balance-service";

export const runtime = "nodejs";

/** The caller's wallet: current balance plus recent ledger entries. */
export async function GET(request: Request) {
  try {
    const { user, supabase } = await requireUserWithClient();
    const url = new URL(request.url);
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20),
    );

    const [balanceIdr, transactions] = await Promise.all([
      getBalance(supabase, user.id),
      listTransactions(supabase, user.id, limit),
    ]);

    return ok({ balanceIdr, transactions });
  } catch (err) {
    return fail(err);
  }
}
