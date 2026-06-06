"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Plus,
  Server,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";

import { vpsApi, type VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";

const REGIONS = [
  { value: "ap-jakarta", label: "ap-jakarta", city: "Jakarta" },
  { value: "ap-singapore", label: "ap-singapore", city: "Singapore" },
] as const;

/* -------------------------------------------------------------------------- */
/*  Discovered Lighthouse instance shape (matches NormalizedInstance from the  */
/*  /api/vps/byok/connect response)                                            */
/* -------------------------------------------------------------------------- */

type DiscoveredInstance = {
  externalInstanceId: string;
  name: string;
  status: string;
  region: string;
  ipPublic: string | null;
  cpu: number | null;
  memoryGb: number | null;
  systemDiskGb: number | null;
};

type ConnectResponse = {
  connected?: boolean;
  count?: number;
  instances?: DiscoveredInstance[];
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ByokPage() {
  const router = useRouter();

  const [secretId, setSecretId]   = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [region, setRegion]       = useState("ap-jakarta");
  const [showKey, setShowKey]     = useState(false);

  const [loading, setLoading]     = useState(false);
  const [connected, setConnected] = useState(false);
  const [instances, setInstances] = useState<DiscoveredInstance[]>([]);
  const [message, setMessage]     = useState<string | null>(null);

  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported]   = useState<string[]>([]);

  // Managed (already-imported) instances.
  const [managed, setManaged] = useState<ApiVpsInstance[]>([]);
  const [managedLoading, setManagedLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ApiVpsInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await vpsApi.listInstances();
        if (cancelled) return;
        setManaged(data.instances ?? []);
      } catch {
        // Best-effort: empty list is fine if request fails.
      } finally {
        if (!cancelled) setManagedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(instance: ApiVpsInstance) {
    setRemoving(instance.id);
    setMessage(null);
    try {
      await vpsApi.removeInstance(instance.id);
      setManaged((prev) => prev.filter((i) => i.id !== instance.id));
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to remove instance.");
    } finally {
      setRemoving(null);
      setConfirmRemove(null);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!secretId.trim() || !secretKey.trim()) {
      setMessage("Secret ID and Secret Key are required.");
      setConnected(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const data = (await vpsApi.byokConnect({ secretId, secretKey, region })) as ConnectResponse;
      const list = data.instances ?? [];
      setInstances(list);
      setConnected(true);
      setMessage(
        list.length === 0
          ? `No Lighthouse instances found in ${region}. Try a different region.`
          : `Connected. ${list.length} instance${list.length === 1 ? "" : "s"} found.`,
      );
      try {
        sessionStorage.removeItem("vps:byok-last-error");
      } catch {}
    } catch (err) {
      setConnected(false);
      setInstances([]);
      const msg = err instanceof Error ? err.message : "Failed to connect to Tencent Cloud.";
      setMessage(msg);
      try {
        sessionStorage.setItem("vps:byok-last-error", msg);
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(externalInstanceId: string) {
    setImporting(externalInstanceId);
    setMessage(null);
    try {
      await vpsApi.byokImport({
        externalInstanceId,
        secretId,
        secretKey,
        region,
      });
      setImported((prev) => [...prev, externalInstanceId]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to import instance.");
      setConnected(true);
    } finally {
      setImporting(null);
    }
  }

  const statusDot = (s: string) =>
    s === "RUNNING"
      ? "bg-[#3ecf8e] shadow-[0_0_6px_#3ecf8e]"
      : "bg-white/25";

  return (
    <div className="pb-24 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-[#1c1c1c]/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href="/dashboard/vps"
          aria-label="Back to VPS"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <KeyRound className="h-4 w-4 text-white/40" aria-hidden />
        <h1 className="text-[14px] font-medium text-white">BYOK — Bring Your Own VPS</h1>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        {/* Info banner */}
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4 text-[12px] leading-relaxed text-white/45">
          Connect your existing Tencent Cloud (Lighthouse) account to import and manage your VPS instances directly from this dashboard. Credentials are encrypted at rest and used to drive provider actions on your behalf.
        </div>

        {/* Managed instances */}
        {(managedLoading || managed.length > 0) && (
          <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-3.5">
              <h2 className="text-[14px] font-medium text-white">
                Managed Instances
                {!managedLoading && (
                  <span className="ml-2 text-[12px] font-normal text-white/40">
                    {managed.length} active
                  </span>
                )}
              </h2>
            </div>
            {managedLoading ? (
              <div className="px-6 py-6 text-[12px] text-white/40">
                Loading managed instances…
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {managed.map((inst) => {
                  const busy = removing === inst.id;
                  return (
                    <div
                      key={inst.id}
                      className="flex items-center justify-between gap-4 px-6 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(
                              (inst.provider_status ?? inst.status ?? "").toUpperCase(),
                            )}`}
                          />
                          <span className="font-medium text-[14px] text-white">{inst.name}</span>
                          <span className="font-mono text-[11px] text-white/30">
                            {inst.external_instance_id}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/40">
                          <span>{inst.region}</span>
                          {inst.ip_public && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="font-mono">{inst.ip_public}</span>
                            </>
                          )}
                          <span className="text-white/15">·</span>
                          <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/35">
                            {inst.source}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(inst)}
                        disabled={busy}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/[0.05] px-3 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {busy ? "Removing…" : "Remove"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {!managedLoading && managed.length > 0 && (
              <div className="border-t border-white/[0.04] bg-white/[0.02] px-6 py-3 text-[11px] leading-relaxed text-white/40">
                Removing detaches an instance from this dashboard and clears its stored credentials.
                The VPS itself stays running on Tencent Cloud.
              </div>
            )}
          </div>
        )}

        {/* Credentials form */}
        <form onSubmit={handleConnect} className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 space-y-5">
          <h2 className="text-[14px] font-medium text-white">Tencent Cloud Credentials</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">
                Secret ID
              </label>
              <input
                type="text"
                value={secretId}
                onChange={(e) => setSecretId(e.target.value)}
                placeholder="TENCENTCLOUD_SECRET_ID"
                className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">
                Secret Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="TENCENTCLOUD_SECRET_KEY"
                  className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 pr-10 font-mono text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Region</label>
            <RegionSelect value={region} onChange={setRegion} />
          </div>

          {message && (
            <p className={`text-[12px] ${connected ? "text-[#3ecf8e]" : "text-red-400"}`}>{message}</p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
            >
              {loading ? "Connecting…" : "Connect & Fetch"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </form>

        {/* Custom instance */}
        <CustomInstanceForm
          onAdded={(inst) => {
            setManaged((prev) => [...prev, inst]);
            router.refresh();
          }}
        />

        {/* Discovered instances */}
        {instances.length > 0 && (
          <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
            <div className="border-b border-white/[0.05] px-6 py-3.5">
              <h2 className="text-[14px] font-medium text-white">
                Lighthouse Instances · {region}
              </h2>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {instances.map((inst) => {
                const done = imported.includes(inst.externalInstanceId);
                const busy = importing === inst.externalInstanceId;
                return (
                  <div key={inst.externalInstanceId} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(inst.status)}`} />
                        <span className="font-medium text-[14px] text-white">{inst.name}</span>
                        <span className="font-mono text-[11px] text-white/30">{inst.externalInstanceId}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/40">
                        <span>{inst.region}</span>
                        {inst.ipPublic && (
                          <>
                            <span className="text-white/15">·</span>
                            <span className="font-mono">{inst.ipPublic}</span>
                          </>
                        )}
                        {(inst.cpu != null || inst.memoryGb != null || inst.systemDiskGb != null) && (
                          <>
                            <span className="text-white/15">·</span>
                            <span>
                              {inst.cpu ?? "?"} vCPU · {inst.memoryGb ?? "?"} GB · {inst.systemDiskGb ?? "?"} GB
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {done ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] px-3 py-1.5 text-[12px] text-[#3ecf8e]">
                          <Check className="h-3.5 w-3.5" />
                          Imported
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleImport(inst.externalInstanceId)}
                          disabled={busy}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
                        >
                          {busy ? (
                            "Importing…"
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              Add VPS
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {imported.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-[#3ecf8e]/15 bg-[#3ecf8e]/[0.04] px-5 py-4">
            <div className="flex items-center gap-2 text-[13px] text-[#3ecf8e]">
              <Server className="h-4 w-4" />
              {imported.length} instance{imported.length > 1 ? "s" : ""} imported successfully.
            </div>
            <Link
              href="/dashboard/vps"
              className="text-[13px] font-medium text-[#3ecf8e] hover:text-[#24b47e] transition-colors"
            >
              Go to VPS dashboard →
            </Link>
          </div>
        )}
      </main>

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#171717] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">Remove instance?</h3>
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="text-white/35 hover:text-white/60"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-6 text-[13px] leading-relaxed text-white/55">
              {confirmRemove.source === "custom" ? (
                <>
                  Remove <strong className="text-white">{confirmRemove.name}</strong> from this
                  dashboard? This deletes the saved host and SSH credentials for this custom
                  instance. The server itself is not affected, and you can add it again anytime.
                </>
              ) : (
                <>
                  Detach <strong className="text-white">{confirmRemove.name}</strong> from this
                  dashboard? The VPS keeps running on Tencent Cloud and you can re-import it later by
                  reconnecting. Stored Tencent credentials for this instance will be cleared.
                </>
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                className="flex-1 rounded-md border border-white/[0.08] py-2 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemove(confirmRemove)}
                disabled={removing === confirmRemove.id}
                className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 py-2 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:opacity-50"
              >
                {removing === confirmRemove.id ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom region dropdown                                                    */
/* -------------------------------------------------------------------------- */

function RegionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = REGIONS.find((r) => r.value === value) ?? REGIONS[0];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-md border bg-[#1c1c1c] px-3 py-2 text-left transition-colors ${
          open
            ? "border-[#3ecf8e]/40"
            : "border-white/[0.08] hover:border-white/[0.14]"
        }`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0 text-white/35" />
        <span className="flex-1 text-[13px] text-white">
          <span className="font-mono">{current.label}</span>
          <span className="ml-2 text-white/40">{current.city}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-white/[0.08] bg-[#171717] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        >
          {REGIONS.map((r) => {
            const active = r.value === value;
            return (
              <li key={r.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(r.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
                    active
                      ? "bg-white/[0.04] text-white"
                      : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <span className="flex-1">
                    <span className="font-mono">{r.label}</span>
                    <span className="ml-2 text-white/40">{r.city}</span>
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Custom instance form                                                      */
/*  Adds an arbitrary SSH target (not backed by a cloud provider) so it shows */
/*  up in the terminal's instance picker with credentials pre-saved.          */
/* -------------------------------------------------------------------------- */

type CustomAuthMethod = "password" | "key";

function CustomInstanceForm({
  onAdded,
}: {
  onAdded: (instance: ApiVpsInstance) => void;
}) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [authMethod, setAuthMethod] = useState<CustomAuthMethod>("password");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function reset() {
    setName("");
    setHost("");
    setPort("22");
    setUsername("root");
    setAuthMethod("password");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
  }

  function validate(): string | null {
    if (!name.trim()) return "Name is required.";
    if (!host.trim()) return "Host / IP is required.";
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return "Port must be 1–65535.";
    if (!username.trim()) return "Username is required.";
    if (authMethod === "password" && !password.trim()) return "Password is required.";
    if (authMethod === "key" && !privateKey.trim()) return "Private key is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setSaving(true);
    try {
      const { instance } = await vpsApi.byokAddCustom({
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port, 10),
        username: username.trim(),
        authMethod,
        password: authMethod === "password" ? password : undefined,
        privateKey: authMethod === "key" ? privateKey : undefined,
        passphrase: authMethod === "key" && passphrase ? passphrase : undefined,
      });
      onAdded(instance);
      setSuccess(`Added “${instance.name}”. It's now available in the terminal.`);
      reset();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Failed to add custom instance.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none disabled:opacity-50";
  const labelClass =
    "mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35";

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 space-y-5"
    >
      <div className="flex items-center gap-2">
        <TerminalSquare className="h-4 w-4 text-white/40" aria-hidden />
        <h2 className="text-[14px] font-medium text-white">Custom Instance</h2>
      </div>
      <p className="-mt-2 text-[12px] leading-relaxed text-white/45">
        Add any SSH-reachable server by host and credentials. It will appear in the
        terminal&apos;s instance picker with its credentials saved — no cloud provider required.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-server"
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Host / IP</label>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="192.168.1.1"
            disabled={saving}
            className={`${inputClass} font-mono`}
          />
        </div>
        <div>
          <label className={labelClass}>Port</label>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="22"
            disabled={saving}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="root"
            disabled={saving}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Auth Method</label>
        <div className="flex w-fit gap-1 rounded-md border border-white/[0.08] bg-[#1c1c1c] p-0.5">
          {(["password", "key"] as CustomAuthMethod[]).map((m) => (
            <button
              key={m}
              type="button"
              disabled={saving}
              onClick={() => setAuthMethod(m)}
              className={`rounded px-3 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                authMethod === m
                  ? "bg-white/[0.08] text-white"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {m === "password" ? "Password" : "Private Key"}
            </button>
          ))}
        </div>
      </div>

      {authMethod === "password" ? (
        <div>
          <label className={labelClass}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\s/g, ""))}
            placeholder="Enter password"
            disabled={saving}
            className={`${inputClass} font-mono text-[12px]`}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Private Key</label>
            <textarea
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              rows={5}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              disabled={saving}
              className={`${inputClass} resize-none font-mono text-[12px]`}
            />
          </div>
          <div>
            <label className={labelClass}>Passphrase (optional)</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave blank if none"
              disabled={saving}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {error && <p className="text-[12px] text-red-400">{error}</p>}
      {success && <p className="text-[12px] text-[#3ecf8e]">{success}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add Custom Instance"}
          {!saving && <Plus className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}
