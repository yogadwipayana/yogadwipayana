import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { aiDb } from "@/lib/db/ai";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatRedeemedAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export const revalidate = 60;

export default async function AiVouchersPage() {
  /* ── Auth ── */
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  const isLoggedIn = email !== null;

  /* ── DB query (skip entirely when not logged in) ── */
  const vouchers = email
    ? await aiDb.vouchers.findMany({
        where: { redeemedBy: email },
        orderBy: { redeemedAt: "desc" },
        take: 50,
      })
    : [];

  const totalRedeemedUsd = vouchers.reduce((sum, v) => sum + v.amountUsd, 0);

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <div>
          <h2 className="text-[18px] font-medium text-white">Vouchers</h2>
          <p className="mt-1 text-[13px] text-white/40">
            Every voucher you have redeemed on this account.
          </p>
        </div>

        {/* Sign-in banner */}
        {!isLoggedIn && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
            <p className="text-[12px] text-white/40">Sign in to see your voucher history.</p>
          </div>
        )}

        {/* Summary cards */}
        {isLoggedIn && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">
                Total Redeemed
              </p>
              <h3 className="mt-4 text-[30px] font-medium tracking-[-0.03em] text-[#3ecf8e]">
                {formatUsd(totalRedeemedUsd)}
              </h3>
              <p className="mt-1.5 text-[11px] text-white/35">
                {vouchers.length === 1 ? "1 voucher" : `${vouchers.length} vouchers`} redeemed
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-[13px]">
              <p className="mb-4 text-[10px] uppercase tracking-[0.1em] text-white/30">
                How it works
              </p>
              <ul className="space-y-2.5 leading-relaxed text-white/50">
                <li>• Order a credit voucher from the store</li>
                <li>• Redeem the code on the Billing page</li>
                <li>• Credit is added to your balance instantly</li>
              </ul>
            </div>
          </div>
        )}

        {/* Voucher history */}
        <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
          <div className="border-b border-white/[0.05] px-5 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">
              Redemption History
            </p>
          </div>

          {vouchers.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] text-white/40">
                {isLoggedIn ? "No vouchers redeemed yet." : "Sign in to see your voucher history."}
              </p>
              {isLoggedIn && (
                <p className="mt-1 text-[12px] text-white/25">
                  Redeem a voucher code on the Billing page and it will show up here.
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Mobile: stacked rows */}
              <div className="divide-y divide-white/[0.04] sm:hidden">
                {vouchers.map((v) => (
                  <div key={v.id} className="space-y-1.5 px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-mono text-[12px] text-white/80">{v.code}</span>
                      <span className="text-[14px] font-medium text-[#3ecf8e]">
                        +{formatUsd(v.amountUsd)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-white/35">
                        {formatRedeemedAt(v.redeemedAt)}
                      </span>
                      <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                        {v.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.05] text-[10px] uppercase tracking-[0.1em] text-white/30">
                      <th className="px-5 py-3 font-medium">Voucher code</th>
                      <th className="px-5 py-3 font-medium">Redeemed</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {vouchers.map((v) => (
                      <tr key={v.id}>
                        <td className="px-5 py-3.5 font-mono text-[12px] text-white/80">{v.code}</td>
                        <td className="px-5 py-3.5 text-[12px] text-white/45">
                          {formatRedeemedAt(v.redeemedAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                            {v.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right text-[13px] font-medium text-[#3ecf8e]">
                          +{formatUsd(v.amountUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
