import { ArrowRight, ExternalLink, Smartphone, Wallet, Waypoints } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { formatIdr, formatUsd } from "@/lib/money";
import { SMS_PRICE_IDR } from "@/lib/sms-order";
import { getAiCredit, type AiCredit } from "@/lib/server/ai-credit";
import { getBalance, listTransactions } from "@/lib/server/balance-service";
import { SMS_VOUCHER_URL } from "@/lib/store-links";
import { createClient } from "@/utils/supabase/server";

import AddFundsModal from "../ai/billing/AddFundsModal";
import { AiCreditStatusBadge } from "../ai-credit-status";
import { RedeemVoucherModal } from "./redeem-modal";
import { TransactionList } from "./transaction-list";

/** How many ledger entries the overview previews before linking to the full list. */
const PREVIEW_LIMIT = 5;

/**
 * AI credit lives in the AI Router's database, not the wallet's — an outage
 * there degrades the AI card instead of taking the whole balance page down.
 */
async function loadAiCredit(email: string | undefined): Promise<AiCredit | null> {
  if (!email) return null;
  try {
    return await getAiCredit(email);
  } catch (err) {
    console.error("[balance] failed to load AI credit", err);
    return null;
  }
}

function describeAiCredit(credit: AiCredit | null): string {
  if (!credit) return "AI credit is unavailable right now.";
  if (credit.status === "not-configured") return "Top up to activate your AI account.";
  return `Budget ${formatUsd(credit.budgetUsd)} · Spent ${formatUsd(credit.spentUsd)}`;
}

export default async function BalancePage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/balance");

  const [balanceIdr, transactions, aiCredit] = await Promise.all([
    getBalance(supabase, user.id),
    listTransactions(supabase, user.id, PREVIEW_LIMIT),
    loadAiCredit(user.email),
  ]);

  const smsNumbers = Math.floor(balanceIdr / SMS_PRICE_IDR);

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[18px] font-medium text-white">Balance</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/40">
              Prepaid balance for the paid tools. Top up with a voucher — it never
              expires.
            </p>
          </div>
          {/* SMS and AI vouchers are separate kinds, each with its own redeem flow. */}
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <RedeemVoucherModal />
            <AddFundsModal label="Redeem AI voucher" variant="header" />
          </div>
        </div>

        {/* SMS balance + AI credit, side by side */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-lg border border-white/[0.08] bg-[#171717] p-5">
            <div className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-white/30" aria-hidden />
              <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
                SMS balance
              </p>
            </div>
            <h3 className="mt-3 text-[30px] font-medium tracking-[-0.03em] text-[#3ecf8e] tabular-nums">
              {formatIdr(balanceIdr)}
            </h3>
            <p className="mb-5 mt-1.5 text-[12px] text-white/40">
              {smsNumbers > 0
                ? `Enough for ${smsNumbers} SMS ${smsNumbers === 1 ? "number" : "numbers"} at ${formatIdr(SMS_PRICE_IDR)} each.`
                : `You need at least ${formatIdr(SMS_PRICE_IDR)} to order an SMS number.`}
            </p>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[11px] text-white/30">Spend it on</span>
              <Link
                href="/dashboard/sms"
                className="inline-flex items-center gap-1.5 text-[12px] text-white/60 transition-colors hover:text-white"
              >
                SMS OTP
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="flex flex-col rounded-lg border border-white/[0.08] bg-[#171717] p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Waypoints className="h-3.5 w-3.5 text-white/30" aria-hidden />
                <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
                  AI credit balance
                </p>
              </div>
              {aiCredit && <AiCreditStatusBadge status={aiCredit.status} />}
            </div>
            <h3 className="mt-3 text-[30px] font-medium tracking-[-0.03em] text-[#3ecf8e] tabular-nums">
              {aiCredit ? formatUsd(aiCredit.remainingUsd) : "—"}
            </h3>
            <p className="mb-5 mt-1.5 text-[12px] text-white/40">
              {describeAiCredit(aiCredit)}
            </p>
            <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
              <span className="text-[11px] text-white/30">Spend it on</span>
              <Link
                href="/dashboard/ai"
                className="inline-flex items-center gap-1.5 text-[12px] text-white/60 transition-colors hover:text-white"
              >
                AI Router
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5">
          <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
            How it works
          </p>
          <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-white/50">
            <li>• Order a voucher on Marketku</li>
            <li>• Redeem the code here to top up instantly</li>
            <li>
              • Each SMS number costs {formatIdr(SMS_PRICE_IDR)}, refunded
              automatically if no code arrives
            </li>
            <li>
              • AI credit is separate — top it up with an AI voucher via{" "}
              <span className="text-white/70">Redeem AI voucher</span>
            </li>
            <li>• No subscription · balance never expires</li>
          </ul>
          <a
            href={SMS_VOUCHER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-[11px] text-white/40 transition-colors hover:text-white/70"
          >
            Order a voucher
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </div>

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[13px] font-medium text-white/70">
              Recent activity
            </h3>
            {transactions.length > 0 && (
              <Link
                href="/dashboard/balance/history"
                className="inline-flex items-center gap-1.5 text-[12px] text-white/45 transition-colors hover:text-white"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            )}
          </div>

          <div className="mt-2">
            {transactions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
                <Wallet className="h-8 w-8 text-white/10" aria-hidden />
                <p className="max-w-xs text-[13px] leading-relaxed text-white/30">
                  No transactions yet. Redeem a voucher to add your first balance.
                </p>
              </div>
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
