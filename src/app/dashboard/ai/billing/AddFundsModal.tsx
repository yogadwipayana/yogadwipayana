"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Ticket, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const VOUCHER_URL = "https://marketku.id/ai/product/ai-router-opus-4-8-sonnet-5-dan-gpt-5-5-c10f5333-679c-405b-a4bc-f746e318bf46";

/* -------------------------------------------------------------------------- */
/*  Shared modal pieces                                                        */
/* -------------------------------------------------------------------------- */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6" onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="redeem-voucher-title"
          className="relative w-full max-w-[480px] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] sm:max-h-[calc(100vh-3rem)]"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 id="redeem-voucher-title" className="text-[17px] font-medium text-white">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-white/30 hover:text-white/60 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AddFundsModal                                                              */
/* -------------------------------------------------------------------------- */

export default function AddFundsModal() {
  const router = useRouter();
  const [open, setOpen]       = useState(false);
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    setCode("");
    setLoading(false);
    setSuccess(false);
    setError(null);
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter the voucher code from your Marketku purchase.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? "Voucher redemption failed. Please try again.");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("Voucher redemption failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
      >
        Redeem voucher
      </button>

      {open && (
        <Overlay onClose={close}>
          <div className="space-y-5">
            <ModalHeader title="Redeem voucher" onClose={close} />

            {success ? (
              <div className="space-y-4">
                <div className="rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] p-4">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#3ecf8e]">Voucher redeemed</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
                    Your credit has been added to your balance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-md bg-[#3ecf8e] py-2.5 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleRedeem} className="space-y-5">
                <p className="text-[13px] leading-relaxed text-white/45">
                  Bought a credit voucher from Marketku? Enter its code to instantly top up your AI balance.
                </p>

                <div>
                  <label htmlFor="voucher-code" className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Voucher code</label>
                  <div className="flex items-center rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 focus-within:border-[#3ecf8e]/40 transition-colors">
                    <Ticket className="h-4 w-4 shrink-0 text-white/30" />
                    <input
                      id="voucher-code"
                      type="text"
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setError(null);
                      }}
                      disabled={loading}
                      placeholder="XXXX-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full bg-transparent px-3 py-2.5 font-mono text-[14px] tracking-wide text-white placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                  <a
                    href={VOUCHER_URL}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                  >
                    Don&apos;t have one? Buy a voucher on Marketku
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {error && <p role="alert" className="mt-1.5 text-[12px] text-red-400">{error}</p>}
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors disabled:opacity-60"
                  >
                    {loading ? "Redeeming…" : "Redeem"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Overlay>
      )}
    </>
  );
}
