"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Props                                                                       */
/* -------------------------------------------------------------------------- */

type Props = {
  keyId: string;
  keyName: string;
};

/* -------------------------------------------------------------------------- */
/*  DeleteKeyButton                                                             */
/* -------------------------------------------------------------------------- */

export default function DeleteKeyButton({ keyId, keyName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Body scroll lock + Esc ── */
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
    if (loading) return;
    setOpen(false);
    setError(null);
  }

  async function handleDelete() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-keys/${keyId}`, { method: "DELETE" });

      if (!res.ok) {
        let msg = "Failed to delete key. Try again.";
        try {
          const data = await res.json();
          if (data?.error) {
            if (res.status === 401) {
              msg = "Session expired. Refresh page.";
            } else if (res.status === 404) {
              msg = "Key not found.";
            } else {
              msg = data.error;
            }
          }
        } catch {
          /* parse failed — use fallback */
        }
        setError(msg);
        setLoading(false);
        return;
      }

      /* success */
      setOpen(false);
      setError(null);
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Delete"
        aria-label={`Delete key ${keyName}`}
        className="rounded p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Modal */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          {/* Positioning wrapper */}
          <div
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6"
            onClick={handleClose}
          >
            {/* Card */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Delete API key"
              className="relative w-full max-w-[420px] rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-medium text-white">Delete Key</h3>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  aria-label="Close"
                  className="text-white/30 hover:text-white/60 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <p className="mt-4 text-[13px] leading-relaxed text-white/50">
                This will permanently delete{" "}
                <strong className="font-medium text-white">{keyName}</strong>. Any integrations
                using this key will stop working immediately.
              </p>

              {/* Inline error */}
              {error && (
                <p className="mt-3 text-[12px] text-red-400">{error}</p>
              )}

              {/* Footer */}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="inline-flex h-9 items-center rounded-md bg-red-500 px-4 text-[13px] font-medium text-white hover:bg-red-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Deleting..." : "Delete key"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
