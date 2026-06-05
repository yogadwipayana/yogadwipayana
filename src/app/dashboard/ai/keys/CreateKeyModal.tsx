"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, X } from "lucide-react";

import { copyToClipboard } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Shared modal pieces (mirrored from AddFundsModal)                          */
/* -------------------------------------------------------------------------- */

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Create API key"
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
      <button
        type="button"
        onClick={onClose}
        className="text-white/30 hover:text-white/60 transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Types                                                                       */
/* -------------------------------------------------------------------------- */

interface CreatedKey {
  key: string;
  name: string;
  id: string;
  owner: string;
}

/* -------------------------------------------------------------------------- */
/*  CreateKeyModal                                                              */
/* -------------------------------------------------------------------------- */

export default function CreateKeyModal() {
  const router = useRouter();

  /* ── Modal open state ── */
  const [open, setOpen] = useState(false);

  /* ── Form state ── */
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Reveal state ── */
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Body scroll lock + Esc key ── */
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    setOpen(false);
    setName("");
    setError(null);
    setLoading(false);
    setCreated(null);
    setCopied(false);
    router.refresh();
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        let msg = "Failed to create key. Try again.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          /* parse failed — use fallback */
        }
        setError(msg);
        setLoading(false);
        return;
      }

      const data: CreatedKey = await res.json();
      setCreated(data);
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    const ok = await copyToClipboard(created.key);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const canCreate = name.trim().length > 0 && !loading;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
        New key
      </button>

      {open && (
        <Overlay onClose={handleClose}>
          <div className="space-y-5">
            {created ? (
              /* ── State 2: Reveal ── */
              <>
                <ModalHeader title="Save your API key" onClose={handleClose} />

                <p className="text-[13px] text-white/45 leading-relaxed">
                  This is the only time the secret will be displayed. Copy it now and store it
                  securely.
                </p>

                <div className="space-y-3">
                  {/* Key name label */}
                  <p className="text-[11px] uppercase tracking-[0.1em] text-white/35">
                    {created.name}
                  </p>

                  {/* Raw key display */}
                  <div className="rounded-md border border-[#3ecf8e]/20 bg-[#1c1c1c] px-4 py-3">
                    <p className="break-all font-mono text-[13px] leading-relaxed text-[#3ecf8e]">
                      {created.key}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-4 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              /* ── State 1: Form ── */
              <>
                <ModalHeader title="New API Key" onClose={handleClose} />

                <div>
                  <label
                    htmlFor="key-name"
                    className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
                  >
                    Key Name
                  </label>
                  <input
                    ref={inputRef}
                    id="key-name"
                    type="text"
                    autoFocus
                    maxLength={48}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canCreate) handleCreate();
                    }}
                    placeholder="e.g. My app key"
                    className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none transition-colors"
                  />
                  <p className="mt-1.5 text-[11px] text-white/35">
                    Give this key a memorable name.
                  </p>
                  {error && (
                    <p className="mt-1.5 text-[12px] text-red-400">{error}</p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canCreate}
                    className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create key"}
                  </button>
                </div>
              </>
            )}
          </div>
        </Overlay>
      )}
    </>
  );
}
