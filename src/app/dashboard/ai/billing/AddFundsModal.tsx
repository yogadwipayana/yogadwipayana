"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Maximize2, MessageCircle, Minus, Plus, QrCode, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const WA_NUMBER     = "6287889640714";
const MERCHANT_NAME = "Dwipa";
const QRIS_SRC      = "/qris.jpg";
const IDR_PER_USD   = 1000;
const STEP          = 5000;
const MIN_AMOUNT    = 5000;
const QUICK_AMOUNTS = [10000, 25000, 50000, 100000];

/* -------------------------------------------------------------------------- */
/*  Shared modal pieces                                                        */
/* -------------------------------------------------------------------------- */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6" onClick={onClose}>
        <div
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
      <h3 className="text-[17px] font-medium text-white">{title}</h3>
      <button type="button" onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  AddFundsModal                                                              */
/* -------------------------------------------------------------------------- */

export default function AddFundsModal() {
  const [addFundsOpen, setAddFundsOpen]     = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [paymentCreated, setPaymentCreated] = useState<{ ref: string; amount: string } | null>(null);
  const [addFundsError, setAddFundsError]   = useState<string | null>(null);
  const [qrPreviewOpen, setQrPreviewOpen]   = useState(false);

  function handleCreateAddFunds() {
    const amount = Number(addFundsAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setAddFundsError("Enter a valid amount in IDR."); return;
    }
    if (amount < MIN_AMOUNT) {
      setAddFundsError(`Minimum top-up is Rp${MIN_AMOUNT.toLocaleString("id-ID")}.`); return;
    }
    setAddFundsError(null);
    setPaymentCreated({
      ref: `DWP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      amount: `Rp${amount.toLocaleString("id-ID")}`,
    });
  }

  function adjustAmount(delta: number) {
    const current = Number(addFundsAmount) || 0;
    const next = Math.max(0, current + delta);
    setAddFundsAmount(next === 0 ? "" : String(next));
    setAddFundsError(null);
  }

  function closeAddFunds() {
    setAddFundsOpen(false); setPaymentCreated(null);
    setAddFundsAmount(""); setAddFundsError(null);
  }

  const waMessage = (ref: string, amount: string) =>
    encodeURIComponent(`Halo Dwipa, saya sudah membayar via QRIS.\nReference: ${ref}\nAmount: ${amount}\nMohon konfirmasi pembayaran ini.`);

  useEffect(() => {
    if (!qrPreviewOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setQrPreviewOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [qrPreviewOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAddFundsOpen(true)}
        className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-white/60 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
      >
        Add funds
      </button>

      {addFundsOpen && (
        <Overlay onClose={closeAddFunds}>
          <div className="space-y-5">
            <ModalHeader title="Add Funds" onClose={closeAddFunds} />

            {paymentCreated ? (
              <div className="space-y-4">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Reference</p>
                  <p className="mt-1 font-mono text-[14px] font-medium text-white">{paymentCreated.ref}</p>
                  <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-white/30">Amount</p>
                  <p className="mt-1 text-[22px] font-medium text-[#3ecf8e]">{paymentCreated.amount}</p>
                </div>

                <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-3.5 w-3.5 text-[#3ecf8e]" />
                      <p className="text-[12px] font-medium text-white">Scan to pay</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-white/30">QRIS</span>
                  </div>
                  <div className="rounded-md bg-white p-3">
                    <Image
                      src={QRIS_SRC}
                      alt="QRIS payment code"
                      width={1080}
                      height={1344}
                      className="h-auto w-full"
                      priority
                    />
                  </div>
                  <p className="mt-3 text-[11px] text-white/40">
                    Merchant: <span className="text-white/70">{MERCHANT_NAME}</span>
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setQrPreviewOpen(true)}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Full
                    </button>
                    <a
                      href={QRIS_SRC}
                      download="qris-yogadwipayana.jpg"
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-3 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Save
                    </a>
                  </div>
                </div>

                <a
                  href={`https://wa.me/${WA_NUMBER}?text=${waMessage(paymentCreated.ref, paymentCreated.amount)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] py-2.5 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Confirm via WhatsApp
                </a>
                <button type="button" onClick={closeAddFunds} className="w-full rounded-md border border-white/[0.08] py-2.5 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-white/45">
                  Top up your pay-as-you-go credit balance. Payment will be verified manually.
                </p>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Amount (IDR)</label>
                  <div className="flex items-stretch rounded-md border border-white/[0.08] bg-[#1c1c1c] focus-within:border-[#3ecf8e]/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => adjustAmount(-STEP)}
                      disabled={!addFundsAmount || Number(addFundsAmount) <= 0}
                      aria-label={`Decrease by ${STEP.toLocaleString("id-ID")}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/50"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <div className="relative flex flex-1 items-center border-x border-white/[0.06]">
                      <span className="pointer-events-none absolute left-3 text-[12px] text-white/30">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={addFundsAmount ? Number(addFundsAmount).toLocaleString("id-ID") : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          setAddFundsAmount(digits);
                          setAddFundsError(null);
                        }}
                        placeholder="50.000"
                        className="w-full bg-transparent py-2 pl-9 pr-3 text-center text-[14px] font-medium text-white placeholder:text-white/20 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => adjustAmount(STEP)}
                      aria-label={`Increase by ${STEP.toLocaleString("id-ID")}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_AMOUNTS.map((amount) => {
                      const active = Number(addFundsAmount) === amount;
                      return (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => { setAddFundsAmount(String(amount)); setAddFundsError(null); }}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            active
                              ? "border-[#3ecf8e]/40 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                              : "border-white/[0.08] text-white/50 hover:border-white/[0.15] hover:text-white/80"
                          }`}
                        >
                          Rp{amount.toLocaleString("id-ID")}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-[11px] text-white/35">
                    Rate: <span className="text-white/55">$1 = Rp{IDR_PER_USD.toLocaleString("id-ID")}</span>
                    {Number(addFundsAmount) > 0 && Number.isFinite(Number(addFundsAmount)) && (
                      <span className="ml-1.5 text-white/55">
                        · ≈ ${(Number(addFundsAmount) / IDR_PER_USD).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </p>
                  {addFundsError && <p className="mt-1.5 text-[12px] text-red-400">{addFundsError}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={closeAddFunds} className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={handleCreateAddFunds} className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors">
                    Create payment
                  </button>
                </div>
              </>
            )}
          </div>
        </Overlay>
      )}

      {qrPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QRIS full preview"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setQrPreviewOpen(false)}
        >
          <button
            type="button"
            onClick={() => setQrPreviewOpen(false)}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="rounded-md bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <Image
              src={QRIS_SRC}
              alt="QRIS payment code full preview"
              width={1080}
              height={1344}
              className="max-h-[calc(100vh-64px)] w-auto max-w-full"
              priority
            />
          </div>
        </div>
      )}
    </>
  );
}
