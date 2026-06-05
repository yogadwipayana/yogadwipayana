"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Props                                                                       */
/* -------------------------------------------------------------------------- */

type Props = {
  keyId: string;
  initialName: string;
  initialIsActive: boolean;
};

/* -------------------------------------------------------------------------- */
/*  EditKeyModal                                                                */
/* -------------------------------------------------------------------------- */

export default function EditKeyModal({ keyId, initialName, initialIsActive }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [isActive, setIsActive] = useState(initialIsActive);
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

  function handleOpen() {
    setName(initialName);
    setIsActive(initialIsActive);
    setError(null);
    setLoading(false);
    setOpen(true);
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
    setError(null);
  }

  const hasChanges =
    name.trim() !== initialName || isActive !== initialIsActive;

  const canSave = hasChanges && name.trim().length > 0 && !loading;

  async function handleSave() {
    if (!canSave) return;

    const trimmedName = name.trim();

    /* Build patch — only send changed fields */
    const patch: { name?: string; isActive?: boolean } = {};
    if (trimmedName !== initialName) patch.name = trimmedName;
    if (isActive !== initialIsActive) patch.isActive = isActive;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/ai-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        let msg = "Failed to save changes. Try again.";
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
        onClick={handleOpen}
        title="Edit"
        aria-label={`Edit key ${initialName}`}
        className="rounded p-1.5 text-white/25 hover:bg-white/[0.04] hover:text-white/60 transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
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
              aria-label="Edit API key"
              className="relative w-full max-w-[480px] rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-medium text-white">Edit Key</h3>
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
              <div className="mt-5 space-y-5">
                {/* Key Name */}
                <div>
                  <label
                    htmlFor="edit-key-name"
                    className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35"
                  >
                    Key Name
                  </label>
                  <input
                    id="edit-key-name"
                    type="text"
                    autoFocus
                    maxLength={48}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSave) handleSave();
                    }}
                    placeholder="e.g. My app key"
                    className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none transition-colors"
                  />
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[13px] font-medium text-white/80">Active</p>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      Inactive keys can&apos;t make requests.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsActive((v) => !v)}
                    disabled={loading}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                      isActive
                        ? "border-[#3ecf8e] bg-[#3ecf8e]"
                        : "border-white/20 bg-white/[0.06]"
                    }`}
                    aria-label={isActive ? "Deactivate key" : "Activate key"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isActive ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

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
                  onClick={handleSave}
                  disabled={!canSave}
                  className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
