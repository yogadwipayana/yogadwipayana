"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, Check, Copy, MessageCircle } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const BANK_NAME    = "BCA";
const ACCOUNT_NO   = "4160604196";
const ACCOUNT_NAME = "I KADEK YOGA DWIPAYANA";
const WA_NUMBER    = "6287889640714";
const PRICE_IDR    = 35_000;

/* -------------------------------------------------------------------------- */
/*  Content                                                                    */
/* -------------------------------------------------------------------------- */

function PaymentContent() {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";

  const [copied, setCopied] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const totalText = `Rp${PRICE_IDR.toLocaleString("id-ID")}`;

  const waMessage = encodeURIComponent(
    `Halo admin, saya sudah transfer VPS ${totalText}${orderId ? ` untuk order ${orderId}` : ""} ke ${BANK_NAME} ${ACCOUNT_NO} a.n. ${ACCOUNT_NAME}. Berikut bukti transfer saya.`,
  );

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  async function markSubmitted() {
    await new Promise((r) => setTimeout(r, 600));
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link
            href="/dashboard/vps/order"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-medium text-white">Payment</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {submitted ? (
          /* ── Success state ── */
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#3ecf8e]/25 bg-[#3ecf8e]/10">
              <Check className="h-7 w-7 text-[#3ecf8e]" />
            </div>
            <div>
              <p className="text-[17px] font-medium text-white">Payment submitted</p>
              <p className="mt-1.5 text-[13px] text-white/45">
                Your payment is waiting for admin verification. We will contact you via WhatsApp once confirmed.
              </p>
            </div>
            <Link
              href="/dashboard/vps"
              className="mt-3 inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 hover:bg-white/[0.04] hover:text-white transition-colors"
            >
              Back to VPS dashboard
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
            {/* Bank transfer details */}
            <section className="space-y-4">
              <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6">
                <div className="mb-5 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#3ecf8e]" />
                  <h2 className="text-[15px] font-medium text-white">Bank Transfer</h2>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Bank", value: BANK_NAME, copyKey: "" },
                    { label: "Account number", value: ACCOUNT_NO, copyKey: "acct" },
                    { label: "Account name", value: ACCOUNT_NAME, copyKey: "" },
                    { label: "Amount", value: totalText, copyKey: "amount" },
                  ].map(({ label, value, copyKey }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between rounded-md border border-white/[0.06] bg-[#1c1c1c] px-4 py-3"
                    >
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">{label}</p>
                        <p className="mt-0.5 text-[14px] font-medium text-white">{value}</p>
                      </div>
                      {copyKey && (
                        <button
                          type="button"
                          onClick={() => copyText(value, copyKey)}
                          className="text-white/30 transition-colors hover:text-white/60"
                          aria-label={`Copy ${label}`}
                        >
                          {copied === copyKey ? (
                            <Check className="h-4 w-4 text-[#3ecf8e]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-md border border-white/[0.05] bg-white/[0.03] p-3 text-[12px] leading-relaxed text-white/40">
                  Transfer the exact amount including the last 3 digits of the order number to help us identify your payment faster.
                </div>
              </div>

              <div className="rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.04] p-4 text-[12px] leading-relaxed text-white/50">
                After transferring, click{" "}
                <strong className="text-white/70">&quot;I have transferred&quot;</strong>{" "}
                and send your proof of payment via WhatsApp for faster processing.
              </div>
            </section>

            {/* Order summary */}
            <aside className="space-y-4">
              <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6">
                <h2 className="mb-4 text-[14px] font-medium text-white">Order Summary</h2>

                {orderId && (
                  <div className="mb-3 rounded-md border border-white/[0.06] bg-[#1c1c1c] px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Order ID</p>
                    <p className="mt-0.5 font-mono text-[13px] text-white">{orderId}</p>
                  </div>
                )}

                <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Total</p>
                  <p className="mt-0.5 text-[26px] font-bold text-[#3ecf8e]">{totalText}</p>
                  <p className="mt-1 text-[11px] text-white/30">VPS Starter · 1 month</p>
                </div>

                <div className="mt-5 space-y-2.5">
                  {!showConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowConfirm(true)}
                      className="inline-flex w-full items-center justify-center rounded-md border border-white/[0.08] py-2.5 text-[13px] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white/80"
                    >
                      Confirm transfer
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={markSubmitted}
                      className="inline-flex w-full items-center justify-center rounded-md bg-[#3ecf8e] py-2.5 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
                    >
                      I have transferred ✓
                    </button>
                  )}

                  <a
                    href={`https://wa.me/${WA_NUMBER}?text=${waMessage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] py-2.5 text-[13px] font-medium text-[#3ecf8e] transition-colors hover:bg-[#3ecf8e]/10"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Send proof via WhatsApp
                  </a>
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1c1c1c] p-8 text-center text-[13px] text-white/30">Loading…</div>}>
      <PaymentContent />
    </Suspense>
  );
}
