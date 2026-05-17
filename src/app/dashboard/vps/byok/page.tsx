"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronRight, Eye, EyeOff, Globe, Plus, Server } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type InstanceOption = {
  id: string;
  name: string;
  status: string;
  region: string;
  ip: string | null;
  cpu: number;
  memoryGb: number;
  diskGb: number;
};

/* -------------------------------------------------------------------------- */
/*  Mock data for "connected" state demo                                       */
/* -------------------------------------------------------------------------- */

const MOCK_INSTANCES: InstanceOption[] = [
  { id: "ins-abc123", name: "lighthouse-prod-sg",  status: "RUNNING", region: "ap-singapore", ip: "119.28.44.10",  cpu: 2, memoryGb: 4,  diskGb: 80  },
  { id: "ins-def456", name: "lighthouse-dev-hk",   status: "STOPPED", region: "ap-hongkong",  ip: null,           cpu: 2, memoryGb: 2,  diskGb: 40  },
  { id: "ins-ghi789", name: "lighthouse-worker-gz", status: "RUNNING", region: "ap-guangzhou", ip: "101.33.18.220", cpu: 4, memoryGb: 8,  diskGb: 160 },
];

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
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [message, setMessage]     = useState<string | null>(null);

  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported]   = useState<string[]>([]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!secretId.trim() || !secretKey.trim()) {
      setMessage("Secret ID and Secret Key are required.");
      return;
    }
    setLoading(true);
    setMessage(null);
    /* Simulate API call — show mock data */
    await new Promise((r) => setTimeout(r, 900));
    setInstances(MOCK_INSTANCES);
    setConnected(true);
    setMessage("Connected. Select an instance to import.");
    setLoading(false);
  }

  async function handleImport(instanceId: string) {
    setImporting(instanceId);
    await new Promise((r) => setTimeout(r, 700));
    setImported((prev) => [...prev, instanceId]);
    setImporting(null);
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
          Connect your existing Tencent Cloud (Lighthouse) account to import and manage your VPS instances directly from this dashboard. Your credentials are used only for the initial import and are not stored.
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
            <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 focus-within:border-[#3ecf8e]/40">
              <Globe className="h-3.5 w-3.5 shrink-0 text-white/35" />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-transparent text-[13px] text-white focus:outline-none"
              >
                <option value="ap-jakarta">ap-jakarta (Jakarta)</option>
                <option value="ap-singapore">ap-singapore (Singapore)</option>
                <option value="ap-hongkong">ap-hongkong (Hong Kong)</option>
                <option value="ap-guangzhou">ap-guangzhou (Guangzhou)</option>
              </select>
            </div>
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
                const done = imported.includes(inst.id);
                const busy = importing === inst.id;
                return (
                  <div key={inst.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(inst.status)}`} />
                        <span className="font-medium text-[14px] text-white">{inst.name}</span>
                        <span className="font-mono text-[11px] text-white/30">{inst.id}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/40">
                        <span>{inst.region}</span>
                        {inst.ip && (
                          <>
                            <span className="text-white/15">·</span>
                            <span className="font-mono">{inst.ip}</span>
                          </>
                        )}
                        <span className="text-white/15">·</span>
                        <span>{inst.cpu} vCPU · {inst.memoryGb} GB · {inst.diskGb} GB</span>
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
                          onClick={() => handleImport(inst.id)}
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
