"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Plus,
  Server,
} from "lucide-react";

import { vpsApi } from "@/lib/client/vps-api";

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
    } catch (err) {
      setConnected(false);
      setInstances([]);
      setMessage(err instanceof Error ? err.message : "Failed to connect to Tencent Cloud.");
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
    <div className="min-h-screen bg-[#1c1c1c] pb-24 text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link
            href="/dashboard/vps"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-[15px] font-medium text-white">BYOK — Bring Your Own VPS</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        {/* Info banner */}
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-4 text-[12px] leading-relaxed text-white/45">
          Connect your existing Tencent Cloud (Lighthouse) account to import and manage your VPS instances directly from this dashboard. Credentials are encrypted at rest and used to drive provider actions on your behalf.
        </div>

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
