"use client";

import { useState } from "react";
import { Check, Copy, Edit2, Key, Plus, Trash2, X } from "lucide-react";

import type { AiApiKey } from "../../data";
import { AI_API_KEYS } from "../../data";
import { copyToClipboard } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(value));
}

function generateFakeSecret() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "sk-" + Array.from(arr, (b) => chars[b % chars.length]).join("");
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717]">{children}</div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">{label}</label>
      {children}
      {helper && <p className="mt-1.5 text-[11px] text-white/30">{helper}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AiKeysPage() {
  const [keys, setKeys] = useState<AiApiKey[]>(AI_API_KEYS);

  /* Create modal */
  const [showCreate, setShowCreate] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<AiApiKey | null>(null);
  const [copiedCreated, setCopiedCreated] = useState(false);

  /* Inline copy per row */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* Edit modal — payg only, no mode selection needed */
  const [editingKey, setEditingKey] = useState<AiApiKey | null>(null);

  /* Delete modal */
  const [deletingKey, setDeletingKey] = useState<AiApiKey | null>(null);

  /* ── Handlers ── */

  function openCreate() {
    setDraftLabel(""); setCreateError(null);
    setCreatedKey(null); setCopiedCreated(false); setShowCreate(true);
  }

  function closeCreate() {
    setShowCreate(false); setCreatedKey(null); setCopiedCreated(false);
    setDraftLabel(""); setCreateError(null);
  }

  function handleCreate() {
    const label = draftLabel.trim();
    if (!label) { setCreateError("Key name is required."); return; }
    if (keys.some((k) => k.label.toLowerCase() === label.toLowerCase())) {
      setCreateError("A key with this name already exists."); return;
    }
    const secret = generateFakeSecret();
    const newKey: AiApiKey = {
      id: `ak${Date.now()}`,
      label,
      maskedKey: `sk-...${secret.slice(-4)}`,
      usageMode: "payg",
      createdAt: new Date().toISOString().split("T")[0],
      lastUsedAt: null,
      secret,
    };
    setKeys((prev) => [newKey, ...prev]);
    setCreatedKey(newKey);
    setCreateError(null);
  }

  async function copySecret(text: string) {
    await copyToClipboard(text);
    setCopiedCreated(true);
    setTimeout(() => setCopiedCreated(false), 1500);
  }

  async function copyMasked(keyId: string) {
    await copyToClipboard(keyId);
    setCopiedId(keyId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  function handleDelete() {
    if (!deletingKey) return;
    setKeys((prev) => prev.filter((k) => k.id !== deletingKey.id));
    setDeletingKey(null);
  }

  const isAnyModal = showCreate || !!editingKey || !!deletingKey;

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium text-white">API Keys</h2>
            <p className="mt-1 text-[13px] text-white/40">
              Create and manage keys to authenticate requests to the AI router.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New key
          </button>
        </div>

        {/* Keys list */}
        {keys.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Key className="h-8 w-8 text-white/10" />
              <p className="text-[13px] text-white/30">No API keys yet</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-[#171717] px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-white">{key.label}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-amber-300">
                      payg
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/40">
                    <span className="font-mono">{key.maskedKey}</span>
                    <span className="text-white/20">·</span>
                    <span>Added {formatDate(key.createdAt)}</span>
                    {key.lastUsedAt && (
                      <>
                        <span className="text-white/20">·</span>
                        <span>Last used {formatDate(key.lastUsedAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => copyMasked(key.maskedKey)}
                    className="rounded p-1.5 text-white/25 hover:bg-white/[0.04] hover:text-white/60 transition-colors"
                    title="Copy key"
                  >
                    {copiedId === key.id
                      ? <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingKey(key)}
                    className="rounded p-1.5 text-white/25 hover:bg-white/[0.04] hover:text-white/60 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingKey(key)}
                    className="rounded p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <Card>
          <div className="px-5 py-4 text-[12px] text-white/40 leading-relaxed">
            All keys use <span className="text-amber-300">Pay as you go</span> billing — requests are charged against your credit balance at standard model rates.
          </div>
        </Card>
      </div>

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal onClose={closeCreate}>
          {createdKey ? (
            /* Reveal state */
            <div className="space-y-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.1em] text-white/35">{createdKey.label}</p>
                <h3 className="mt-2 text-[20px] font-medium text-white">Save your API key</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
                  This is the only time the secret will be displayed. Copy it now and store it securely.
                </p>
              </div>
              <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#1c1c1c] p-4">
                <p className="break-all font-mono text-[12px] leading-relaxed text-[#3ecf8e]">
                  {createdKey.secret}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => copySecret(createdKey.secret!)}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-4 text-[13px] text-white/60 hover:bg-white/[0.04] transition-colors"
                >
                  {copiedCreated ? <><Check className="h-3.5 w-3.5 text-[#3ecf8e]" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </button>
                <button
                  type="button"
                  onClick={closeCreate}
                  className="inline-flex h-9 items-center justify-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Create form */
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-[17px] font-medium text-white">New API Key</h3>
                <button type="button" onClick={closeCreate} className="text-white/30 hover:text-white/60">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <Field label="Key Name" helper="Give this key a memorable name.">
                <input
                  type="text"
                  value={draftLabel}
                  onChange={(e) => { setDraftLabel(e.target.value); setCreateError(null); }}
                  autoFocus
                  maxLength={48}
                  placeholder="e.g. production"
                  className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                />
                {createError && <p className="mt-1.5 text-[12px] text-red-400">{createError}</p>}
              </Field>

              <p className="text-[12px] text-white/35">
                Billing: <span className="text-amber-300">Pay as you go</span> — charged against your credit balance.
              </p>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeCreate}
                  className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] hover:bg-[#24b47e] transition-colors"
                >
                  Create key
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ── Edit modal — payg only, nothing to change ── */}
      {editingKey && (
        <Modal onClose={() => setEditingKey(null)}>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-medium text-white">Key Info</h3>
              <button type="button" onClick={() => setEditingKey(null)} className="text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4 space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-white/40">Name</span>
                <span className="font-medium text-white">{editingKey.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Key</span>
                <span className="font-mono text-white/60">{editingKey.maskedKey}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Billing</span>
                <span className="text-amber-300">Pay as you go</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Added</span>
                <span className="text-white/60">{formatDate(editingKey.createdAt)}</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setEditingKey(null)} className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors">
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Delete modal ── */}
      {deletingKey && (
        <Modal onClose={() => setDeletingKey(null)}>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-medium text-white">Delete Key</h3>
              <button type="button" onClick={() => setDeletingKey(null)} className="text-white/30 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-white/55">
              This will permanently delete{" "}
              <strong className="text-white">{deletingKey.label}</strong>.
              Any integrations using this key will stop working immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingKey(null)} className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/50 hover:bg-white/[0.04] transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleDelete} className="inline-flex h-9 items-center rounded-md border border-red-500/30 bg-red-500/10 px-4 text-[13px] font-medium text-red-400 hover:bg-red-500/15 transition-colors">
                Delete key
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Backdrop blur for modals */}
      {isAnyModal && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[2px]"
          onClick={() => { setShowCreate(false); setEditingKey(null); setDeletingKey(null); }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modal wrapper                                                              */
/* -------------------------------------------------------------------------- */

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 pt-16 sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="relative w-full max-w-[480px] rounded-xl border border-white/[0.1] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
