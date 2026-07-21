"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Ticket, X } from "lucide-react";

import { formatIdr } from "@/lib/money";

/** Where a buyer without a code goes to get one. */
export const VOUCHER_WHATSAPP_URL = `https://wa.me/6287889640714?text=${encodeURIComponent(
  "Hi, I want to buy a balance voucher for the SMS OTP tool — clicked from the balance dashboard.",
)}`;

type RedeemResponse = {
  code: string;
  amountIdr: number;
  balanceIdr: number;
};

export function RedeemVoucherModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RedeemResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setCode("");
    setLoading(false);
    setResult(null);
    setError(null);
  }

  // Esc closes. Bound only while open so the listener isn't live on every page.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter the voucher code from your purchase.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/balance/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = (await res.json().catch(() => null)) as
        | (RedeemResponse & { error?: { message?: string } })
        | null;

      if (!res.ok) {
        setError(body?.error?.message ?? "Redemption failed. Please try again.");
        return;
      }

      setResult(body as RedeemResponse);
      // The balance lives in a server component; re-render it with the new figure.
      router.refresh();
    } catch {
      setError("Network error while redeeming. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3.5 py-2 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
      >
        <Ticket className="h-4 w-4" aria-hidden />
        Redeem voucher
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="fixed inset-0 z-40 cursor-default bg-black/70 backdrop-blur-[2px]"
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="redeem-balance-title"
              className="relative max-h-[calc(100vh-5rem)] w-full max-w-[460px] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] sm:max-h-[calc(100vh-3rem)]"
            >
              <div className="flex items-center justify-between">
                <h3
                  id="redeem-balance-title"
                  className="text-[16px] font-medium text-white"
                >
                  Redeem voucher
                </h3>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="text-white/30 transition-colors hover:text-white/60"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {result ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] p-4">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                      {result.amountIdr > 0 ? "Voucher redeemed" : "Already redeemed"}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                      {result.amountIdr > 0
                        ? `${formatIdr(result.amountIdr)} added. Your balance is now ${formatIdr(result.balanceIdr)}.`
                        : `This code was already applied. Your balance is ${formatIdr(result.balanceIdr)}.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full rounded-md bg-[#3ecf8e] py-2.5 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRedeem} className="mt-5 space-y-5">
                  <p className="text-[13px] leading-relaxed text-white/45">
                    Enter your voucher code to add balance instantly. Balance is
                    used to pay for SMS OTP numbers.
                  </p>

                  <div>
                    <label
                      htmlFor="balance-voucher-code"
                      className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
                    >
                      Voucher code
                    </label>
                    <div className="flex items-center rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 transition-colors focus-within:border-[#3ecf8e]/40">
                      <Ticket className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                      <input
                        id="balance-voucher-code"
                        type="text"
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value);
                          setError(null);
                        }}
                        disabled={loading}
                        placeholder="V-XXXX-XXXX-XXXX"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full bg-transparent px-3 py-2.5 font-mono text-[14px] tracking-wide text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20 focus:outline-none disabled:opacity-50"
                      />
                    </div>
                    <a
                      href={VOUCHER_WHATSAPP_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/40 transition-colors hover:text-white/70"
                    >
                      Don&apos;t have one? Order a voucher via WhatsApp
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                    {error && (
                      <p role="alert" className="mt-1.5 text-[12px] text-red-400">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={close}
                      className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 transition-colors hover:bg-white/[0.04]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
                    >
                      {loading ? "Redeeming…" : "Redeem"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
