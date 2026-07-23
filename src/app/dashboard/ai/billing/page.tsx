import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { aiDb } from "@/lib/db/ai";
import AddFundsModal from "./AddFundsModal";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatUsd(value: number): string {
  const decimals = value > 0 && value <= 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export const revalidate = 60;

export default async function AiBillingPage() {
  /* ── Auth ── */
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  /* ── DB queries (skip entirely when not logged in) ── */
  // Spend comes from the pre-aggregated `ownerSpend` table — one row per owner,
  // maintained upstream. Verified to match SUM(usageHistory.cost) exactly, at a
  // fraction of the cost of scanning the full history.
  const [owner, spend] = email
    ? await Promise.all([
        aiDb.ownerUsers.findUnique({ where: { email } }),
        aiDb.ownerSpend.findUnique({ where: { owner: email } }),
      ])
    : [null, null];

  const spentUsd     = spend?.spentUsd ?? 0;
  const budgetUsd    = owner?.budgetUsd ?? 0;
  const remainingUsd = Math.max(0, budgetUsd - spentUsd);

  /* ── Derived display values ── */
  const isLoggedIn = email !== null;

  type BadgeVariant = "active" | "inactive" | "not-configured" | "sign-in";
  let badgeVariant: BadgeVariant;
  let badgeLabel: string;

  if (!isLoggedIn) {
    badgeVariant = "sign-in";
    badgeLabel   = "Sign in";
  } else if (!owner) {
    badgeVariant = "not-configured";
    badgeLabel   = "Not configured";
  } else if (owner.isActive === 1) {
    badgeVariant = "active";
    badgeLabel   = "Active";
  } else {
    badgeVariant = "inactive";
    badgeLabel   = "Inactive";
  }

  const badgeClass =
    badgeVariant === "active"
      ? "text-[#3ecf8e]"
      : badgeVariant === "inactive"
        ? "text-yellow-400"
        : "text-white/40";

  const balanceDisplay = isLoggedIn ? formatUsd(remainingUsd) : "—";

  const subtext = isLoggedIn
    ? owner
      ? `Budget ${formatUsd(budgetUsd)} · Spent ${formatUsd(spentUsd)}`
      : "Top up to activate your AI account"
    : null;

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <div>
          <h2 className="text-[18px] font-medium text-white">Billing Overview</h2>
          <p className="mt-1 text-[13px] text-white/40">Pay as you go — only pay for what you use.</p>
        </div>

        {/* Sign-in banner */}
        {!isLoggedIn && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
            <p className="text-[12px] text-white/40">Sign in to see your AI billing.</p>
          </div>
        )}

        {/* Credit balance card */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col rounded-lg border border-white/[0.08] bg-[#171717] p-5">
            <div className="flex items-start justify-between gap-4">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Credit Balance</p>
              <span className={`text-[10px] uppercase tracking-[0.1em] ${badgeClass}`}>
                {badgeLabel}
              </span>
            </div>
            <h3 className="mt-4 text-[30px] font-medium tracking-[-0.03em] text-[#3ecf8e]">
              {balanceDisplay}
            </h3>
            {subtext ? (
              <p className="mt-1.5 text-[11px] text-white/35">{subtext}</p>
            ) : null}
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">
              Available balance for model requests. Requests are billed per token at standard rates.
            </p>
            <div className="mt-auto flex items-end justify-between border-t border-white/[0.06] pt-4 mt-5">
              <p className="text-[11px] text-white/30">Balance available now</p>
              <AddFundsModal />
            </div>
          </div>

          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-[13px]">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30 mb-4">How it works</p>
            <ul className="space-y-2.5 text-white/50 leading-relaxed">
              <li>• Order a credit voucher from the store</li>
              <li>• Redeem the code here to top up instantly</li>
              <li>• Exchange rate: <span className="text-white/70">Rp 10.000 = $25</span></li>
              <li>• Requests are charged at standard model rates per 1M tokens</li>
              <li>• No subscription · balance never expires</li>
            </ul>
          </div>
        </div>

        {/* Rate info */}
        <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
          <div className="border-b border-white/[0.05] px-5 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">Billing</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {[
              { label: "Pay as you go",  detail: "Charged per token · standard model rates", badge: "current" },
              { label: "Voucher top-up", detail: "Order a credit voucher from the store", badge: null },
              { label: "Redeem",         detail: "Enter the voucher code to add credit instantly", badge: null },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-white">{row.label}</span>
                  {row.badge === "current" && (
                    <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-right text-[12px] text-white/40">{row.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
