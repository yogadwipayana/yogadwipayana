import { formatIdr } from "@/lib/money";
import type {
  BalanceTransactionKind,
  BalanceTransactionRow,
} from "@/lib/server/balance-service";

const KIND_LABEL: Record<BalanceTransactionKind, string> = {
  topup: "Top-up",
  sms_order: "SMS number",
  sms_refund: "Refund",
  adjustment: "Adjustment",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * The ledger, newest first. Rendered on the server, so the timestamps use the
 * server's timezone — same trade-off the SMS history page already makes.
 */
export function TransactionList({
  transactions,
}: {
  transactions: BalanceTransactionRow[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]">
      {transactions.map((tx, index) => {
        const credit = tx.amount_idr > 0;
        return (
          <div
            key={tx.id}
            className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
              index > 0 ? "border-t border-white/[0.06]" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-[13px] text-white/85">
                {tx.description || KIND_LABEL[tx.kind]}
              </p>
              <p className="mt-0.5 text-[11px] text-white/35">
                {KIND_LABEL[tx.kind]} · {formatTime(tx.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p
                className={`text-[13px] font-medium tabular-nums ${
                  credit ? "text-[#3ecf8e]" : "text-white/80"
                }`}
              >
                {credit ? "+" : "−"}
                {formatIdr(Math.abs(tx.amount_idr))}
              </p>
              <p className="mt-0.5 text-[11px] text-white/30 tabular-nums">
                {formatIdr(tx.balance_after)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
