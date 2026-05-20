"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Key,
  Plus,
  Sparkles,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";

import { vpsApi } from "@/lib/client/vps-api";
import { copyToClipboard } from "@/lib/utils";

type TencentKeyPair = {
  KeyId: string;
  KeyName?: string;
  PublicKey?: string;
  PrivateKey?: string;
  AssociatedInstanceIds?: string[];
  CreatedTime?: string;
};

type Mode = "idle" | "import" | "generate";

export default function VpsSshKeysPage() {
  const [keys, setKeys] = useState<TencentKeyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");

  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [generated, setGenerated] = useState<TencentKeyPair | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);

  const [editing, setEditing] = useState<TencentKeyPair | null>(null);
  const [editName, setEditName] = useState("");
  const [editPublicKey, setEditPublicKey] = useState("");

  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<TencentKeyPair | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await vpsApi.listSshKeys()) as { keys?: TencentKeyPair[] };
      setKeys(data.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SSH keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await vpsApi.listSshKeys()) as { keys?: TencentKeyPair[] };
        if (cancelled) return;
        setKeys(data.keys ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load SSH keys");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetForms() {
    setKeyName("");
    setPublicKey("");
    setMode("idle");
  }

  async function handleImport() {
    if (!keyName.trim() || !publicKey.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await vpsApi.importSshKey(keyName.trim(), publicKey.trim());
      resetForms();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import SSH key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerate() {
    if (!keyName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const data = (await vpsApi.generateSshKey(keyName.trim())) as {
        key?: TencentKeyPair;
      };
      setGenerated(data.key ?? null);
      setShowPrivate(false);
      resetForms();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate SSH key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit() {
    if (!editing || !editName.trim() || !editPublicKey.trim()) return;
    setError(null);
    setBusyKeyId(editing.KeyId);
    try {
      await vpsApi.editSshKey(editing.KeyId, {
        keyName: editName.trim(),
        publicKey: editPublicKey.trim(),
      });
      setEditing(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update SSH key");
    } finally {
      setBusyKeyId(null);
    }
  }

  async function handleDelete(key: TencentKeyPair) {
    setError(null);
    setBusyKeyId(key.KeyId);
    try {
      await vpsApi.deleteSshKey(key.KeyId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete SSH key");
    } finally {
      setBusyKeyId(null);
      setConfirmDelete(null);
    }
  }

  async function copy(text: string, id: string) {
    await copyToClipboard(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  function downloadPrivateKey() {
    if (!generated?.PrivateKey) return;
    const blob = new Blob([generated.PrivateKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generated.KeyName ?? generated.KeyId}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] pb-24 text-white">
      <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard/vps"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-medium text-white">SSH Keys</h1>
          <div className="ml-auto">
            <Link
              href="/dashboard/vps/terminal"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white/70 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/[0.06] hover:text-[#3ecf8e]"
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Open Terminal
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4 text-[12px] leading-relaxed text-white/45">
          Manage the SSH keys stored in your Tencent Cloud account. Generate a new
          key pair, import an existing public key, or rotate an old one. Bind keys
          to specific instances from each VPS&apos;s SSH Keys tab.
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-white">All SSH Keys</h2>
            <p className="mt-0.5 text-[12px] text-white/40">
              {keys.length} key{keys.length !== 1 ? "s" : ""} in this account
            </p>
          </div>
          {mode === "idle" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("generate")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white/70 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/[0.06] hover:text-[#3ecf8e]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate
              </button>
              <button
                type="button"
                onClick={() => setMode("import")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
              >
                <Plus className="h-3.5 w-3.5" />
                Import key
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* Import form */}
        {mode === "import" && (
          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-white/65">
                Import public key
              </span>
              <button
                type="button"
                onClick={resetForms}
                className="text-white/30 transition-colors hover:text-white/60"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <FieldGroup label="Key Name">
              <FormInput
                value={keyName}
                onChange={setKeyName}
                placeholder="e.g. macbook-personal"
              />
            </FieldGroup>

            <FieldGroup label="Public Key">
              <textarea
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                rows={4}
                placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
                className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
              />
            </FieldGroup>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={submitting || !keyName.trim() || !publicKey.trim()}
                className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
              >
                {submitting ? "Importing…" : "Import key"}
              </button>
              <button
                type="button"
                onClick={resetForms}
                className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-3 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Generate form */}
        {mode === "generate" && (
          <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-white/65">
                Generate new key pair
              </span>
              <button
                type="button"
                onClick={resetForms}
                className="text-white/30 transition-colors hover:text-white/60"
                aria-label="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <FieldGroup label="Key Name">
              <FormInput
                value={keyName}
                onChange={setKeyName}
                placeholder="e.g. prod-bastion"
              />
            </FieldGroup>

            <p className="text-[12px] leading-relaxed text-white/40">
              Tencent Cloud will create the key pair. The private key is shown
              only once after generation — copy or download it before closing
              this view.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={submitting || !keyName.trim()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {submitting ? "Generating…" : "Generate key pair"}
              </button>
              <button
                type="button"
                onClick={resetForms}
                className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-3 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Generated key pair (one-time display) */}
        {generated && (
          <div className="space-y-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-amber-300" />
                  <span className="text-[14px] font-medium text-amber-100">
                    {generated.KeyName ?? generated.KeyId}
                  </span>
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-amber-300">
                    new
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-amber-200/70">
                  Save the private key now — it can&apos;t be shown again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGenerated(null)}
                className="text-amber-200/50 transition-colors hover:text-amber-100"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {generated.PrivateKey && (
              <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#0f0f0f]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">
                    Private key
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPrivate((v) => !v)}
                      className="inline-flex items-center gap-1 rounded p-1 text-white/40 transition-colors hover:text-white/70"
                      aria-label={showPrivate ? "Hide" : "Show"}
                    >
                      {showPrivate ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(generated.PrivateKey!, "private")}
                      className="inline-flex items-center gap-1 rounded p-1 text-white/40 transition-colors hover:text-white/70"
                      aria-label="Copy private key"
                    >
                      {copied === "private" ? (
                        <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={downloadPrivateKey}
                      className="inline-flex items-center gap-1 rounded p-1 text-white/40 transition-colors hover:text-white/70"
                      aria-label="Download .pem"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <pre className="max-h-64 overflow-auto px-3 py-3 font-mono text-[11px] leading-relaxed text-white/80">
                  {showPrivate
                    ? generated.PrivateKey
                    : generated.PrivateKey.replace(/[^\n]/g, "•")}
                </pre>
              </div>
            )}

            {generated.PublicKey && (
              <div className="overflow-hidden rounded-md border border-white/[0.06] bg-[#0f0f0f]">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">
                    Public key
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(generated.PublicKey!, "public")}
                    className="inline-flex items-center gap-1 rounded p-1 text-white/40 transition-colors hover:text-white/70"
                    aria-label="Copy public key"
                  >
                    {copied === "public" ? (
                      <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <pre className="max-h-32 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-white/70">
                  {generated.PublicKey}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-lg border border-white/[0.05] bg-white/[0.02]"
              />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/[0.06] py-14">
            <Key className="h-8 w-8 text-white/10" />
            <p className="text-[13px] text-white/30">
              No SSH keys in your account yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => {
              if (!key.KeyId) return null;
              const isEditing = editing?.KeyId === key.KeyId;
              const busy = busyKeyId === key.KeyId;
              const pk = key.PublicKey ?? "";
              const boundCount = key.AssociatedInstanceIds?.length ?? 0;
              return (
                <div
                  key={key.KeyId}
                  className="rounded-lg border border-white/[0.06] bg-[#171717] p-4"
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <FieldGroup label="Key Name">
                        <FormInput
                          value={editName}
                          onChange={setEditName}
                          placeholder="Key name"
                        />
                      </FieldGroup>
                      <FieldGroup label="Public Key">
                        <textarea
                          value={editPublicKey}
                          onChange={(e) => setEditPublicKey(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                        />
                      </FieldGroup>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={busy}
                          className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
                        >
                          {busy ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-3 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Key className="h-3.5 w-3.5 shrink-0 text-white/30" />
                          <span className="text-[14px] font-medium text-white">
                            {key.KeyName ?? key.KeyId}
                          </span>
                          {boundCount > 0 && (
                            <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                              {boundCount} bound
                            </span>
                          )}
                          <span className="font-mono text-[11px] text-white/30">
                            {key.KeyId}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="max-w-[360px] truncate font-mono text-[11px] text-white/30">
                            {pk.slice(0, 72)}
                            {pk.length > 72 ? "…" : ""}
                          </span>
                          {pk && (
                            <button
                              type="button"
                              onClick={() => copy(pk, key.KeyId)}
                              className="text-white/25 transition-colors hover:text-white/55"
                              aria-label="Copy public key"
                            >
                              {copied === key.KeyId ? (
                                <Check className="h-3 w-3 text-[#3ecf8e]" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          )}
                        </div>
                        {key.CreatedTime && (
                          <p className="mt-1 text-[11px] text-white/25">
                            Added {key.CreatedTime.slice(0, 10)}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(key);
                            setEditName(key.KeyName ?? "");
                            setEditPublicKey(key.PublicKey ?? "");
                          }}
                          className="rounded p-1.5 text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
                          aria-label="Edit key"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(key)}
                          disabled={busy}
                          className="rounded p-1.5 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                          aria-label="Delete key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#171717] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">Delete SSH key?</h3>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="text-white/35 hover:text-white/60"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-6 text-[13px] leading-relaxed text-white/55">
              Permanently delete{" "}
              <strong className="text-white">
                {confirmDelete.KeyName ?? confirmDelete.KeyId}
              </strong>
              ? Instances bound to this key will lose access on the next reboot.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-md border border-white/[0.08] py-2 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                disabled={busyKeyId === confirmDelete.KeyId}
                className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 py-2 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
              >
                {busyKeyId === confirmDelete.KeyId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-white/35">
        {label}
      </label>
      {children}
    </div>
  );
}

function FormInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
    />
  );
}
