import { Wallet } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/Pagination";
import { formatIdr } from "@/lib/money";
import {
  getBalance,
  ledgerTotals,
  listTransactionsPage,
} from "@/lib/server/balance-service";
import { createClient } from "@/utils/supabase/server";

import { TransactionList } from "../transaction-list";

const PAGE_SIZE = 10;

export default async function BalanceHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/balance/history");

  const [balanceIdr, { transactions, total }, { toppedUpIdr, spentIdr }] =
    await Promise.all([
      getBalance(supabase, user.id),
      listTransactionsPage(supabase, user.id, page, PAGE_SIZE),
      // Totals span the whole ledger, so the summary line doesn't change as the
      // reader pages through it.
      ledgerTotals(supabase, user.id),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        <div>
          <h2 className="text-[18px] font-medium text-white">Transactions</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/40">
            Every movement on your balance — {formatIdr(toppedUpIdr)} topped up,{" "}
            {formatIdr(spentIdr)} spent, {formatIdr(balanceIdr)} available.
          </p>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
            <Wallet className="h-8 w-8 text-white/10" aria-hidden />
            <p className="text-[13px] text-white/30">No transactions yet.</p>
          </div>
        ) : transactions.length === 0 ? (
          // Reachable by editing `?page=` past the end; offer a way back rather
          // than an empty screen with no explanation.
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
            <Wallet className="h-8 w-8 text-white/10" aria-hidden />
            <p className="text-[13px] text-white/30">
              Nothing on this page — there are {totalPages}.
            </p>
          </div>
        ) : (
          <TransactionList transactions={transactions} />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          hrefFor={(target) => `?page=${target}`}
        />
      </div>
    </div>
  );
}
