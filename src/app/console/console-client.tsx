"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  API types — mirror the response of POST /api/console                       */
/* -------------------------------------------------------------------------- */

type TempKeyStatus = "active" | "unused" | "expired" | "depleted" | "disabled";

type ConsoleData = {
  key: {
    name: string | null;
    maskedKey: string;
    note: string | null;
    status: TempKeyStatus;
    budgetUsd: number;
    spentUsd: number;
    remainingUsd: number;
    requestCount: number;
    durationSeconds: number;
    createdAt: string;
    firstUsedAt: string | null;
    expiresAt: string | null;
  };
  totals: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  };
  models: {
    model: string;
    requests: number;
    promptTokens: number;
    completionTokens: number;
    cost: number;
  }[];
  logs: {
    id: number;
    timestamp: string;
    provider: string | null;
    model: string | null;
    endpoint: string | null;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    cost: number;
    status: string | null;
  }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const STORAGE_KEY = "console-temp-key";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatCost(n: number) {
  return `$${n.toFixed(4)}`;
}

function formatTokens(n: number) {
  return new Intl.NumberFormat("en").format(n);
}

// Timestamps are pinned to WITA (Asia/Makassar) to match /dashboard/ai/usage,
// which renders on a server running in that zone — this keeps both surfaces
// consistent regardless of the visitor's local timezone.
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Makassar",
  }).format(new Date(value));
}

function formatDuration(totalSeconds: number): string {
  const parts: string[] = [];
  const d = Math.floor(totalSeconds / 86_400);
  const h = Math.floor((totalSeconds % 86_400) / 3_600);
  const m = Math.floor((totalSeconds % 3_600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length < 2 && s > 0) parts.push(`${s}s`);
  return parts.length > 0 ? parts.slice(0, 2).join(" ") : "0s";
}

const STATUS_STYLES: Record<TempKeyStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]",
  },
  unused: {
    label: "Unused",
    className: "border-white/[0.1] bg-white/[0.04] text-white/50",
  },
  expired: {
    label: "Expired",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  },
  depleted: {
    label: "Budget depleted",
    className: "border-red-400/20 bg-red-400/10 text-red-400",
  },
  disabled: {
    label: "Disabled",
    className: "border-white/[0.1] bg-white/[0.04] text-white/35",
  },
};

async function fetchUsage(key: string, page: number): Promise<ConsoleData> {
  const res = await fetch("/api/console", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, page }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      json &&
      typeof json === "object" &&
      "error" in json &&
      json.error &&
      typeof json.error === "object" &&
      "message" in json.error &&
      typeof json.error.message === "string"
        ? json.error.message
        : "Something went wrong. Try again.";
    throw new Error(message);
  }
  return json as ConsoleData;
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                               */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: TempKeyStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${s.className}`}
    >
      {s.label}
    </span>
  );
}

function MeterCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-2 text-[22px] font-medium leading-none text-white">{value}</p>
      <p className="mt-1.5 text-[11px] text-white/30">{description}</p>
    </div>
  );
}

/** Live countdown to expiry; ticks every second while the key has a deadline. */
function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const msLeft = new Date(expiresAt).getTime() - now;
  if (msLeft <= 0) {
    return <span className="text-amber-300">Expired</span>;
  }
  return (
    <span className="font-mono text-white">{formatDuration(msLeft / 1000)}</span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Key entry (locked state)                                                   */
/* -------------------------------------------------------------------------- */

function KeyGate({
  onSubmit,
  loading,
  error,
}: {
  onSubmit: (key: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);

  const features = [
    {
      icon: Activity,
      title: "Live request logs",
      description: "Every call made with the key, newest first.",
    },
    {
      icon: Wallet,
      title: "Budget & spend",
      description: "Remaining balance, updated per request.",
    },
    {
      icon: Timer,
      title: "Expiry countdown",
      description: "See exactly how long the key stays valid.",
    },
  ];

  return (
    <div className="grid flex-1 lg:grid-cols-2">
      {/* Brand / feature panel */}
      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-[#141414] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.12),transparent)]" />
          <div className="absolute bottom-0 right-0 h-[360px] w-[360px] translate-x-1/3 translate-y-1/3 rounded-full [background:radial-gradient(closest-side,rgba(62,207,142,0.07),transparent)]" />
        </div>

        <span className="relative inline-flex items-center gap-1.5 self-start rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
          <KeyRound className="h-3.5 w-3.5" aria-hidden />
          Console
        </span>

        <div className="relative max-w-md">
          <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-white xl:text-[36px]">
            Watch your temporary key at work.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-white/45">
            A read-only view of everything a temporary AI Router key does — no
            account needed.
          </p>

          <ul className="mt-12 space-y-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className="flex items-start gap-3.5">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03]">
                    <Icon className="h-4 w-4 text-[#3ecf8e]" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-[14px] font-medium text-white/85">
                      {f.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-white/40">
                      {f.description}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="relative flex max-w-md items-start gap-2 text-[12px] leading-relaxed text-white/30">
          <ShieldCheck
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3ecf8e]/70"
            aria-hidden
          />
          Your key stays in this browser tab only — it is never stored on the
          server.
        </p>
      </div>

      {/* Form column */}
      <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-12 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute left-1/2 top-0 h-[320px] w-[560px] -translate-x-1/2 [background:radial-gradient(closest-side,rgba(62,207,142,0.06),transparent)]" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Compact header, shown only when the brand panel is hidden */}
          <div className="mb-7 lg:hidden">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2.5 py-0.5 text-[12px] font-medium text-[#3ecf8e]">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />
              Console
            </span>
            <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-white">
              Watch your temporary key at work.
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/45">
              A read-only view of everything a temporary AI Router key does —
              no account needed.
            </p>
          </div>

          {/* Heading for the form column when the brand panel is visible */}
          <div className="mb-7 hidden lg:block">
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-white">
              Check a key
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/45">
              Paste a temporary API key to see its usage and budget.
            </p>
          </div>

          <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = input.trim();
                if (trimmed) onSubmit(trimmed);
              }}
            >
              <label
                htmlFor="console-key"
                className="text-[12px] font-medium text-white/60"
              >
                Temporary API key
              </label>
              <div className="relative mt-2">
                <KeyRound
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25"
                />
                <input
                  id="console-key"
                  type={revealed ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-11 w-full rounded-md border border-white/[0.1] bg-black/25 pl-10 pr-11 font-mono text-[13px] text-white transition-colors placeholder:text-white/20 focus:border-[#3ecf8e]/50 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/15"
                />
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  aria-label={revealed ? "Hide key" : "Show key"}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-white/35 transition-colors hover:bg-white/[0.04] hover:text-white/70"
                >
                  {revealed ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-md border border-red-400/20 bg-red-400/[0.06] px-3.5 py-2.5 text-[12px] leading-relaxed text-red-400"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || input.trim().length === 0}
                className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/30"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Checking key...
                  </>
                ) : (
                  <>
                    View usage
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

          <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-white/35 lg:hidden">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#3ecf8e]/70"
              aria-hidden
            />
            Your key stays in this browser tab only — it is never stored on
            the server.
          </p>

          <p className="mt-6 text-center text-[12px] text-white/35">
            Need a key?{" "}
            <Link
              href="/ai"
              className="text-white/60 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
            >
              Visit the AI store
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Dashboard (unlocked state)                                                 */
/* -------------------------------------------------------------------------- */

function Dashboard({
  data,
  loading,
  error,
  onRefresh,
  onChangePage,
  onForget,
}: {
  data: ConsoleData;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onChangePage: (page: number) => void;
  onForget: () => void;
}) {
  const { key, totals, models, logs, pagination } = data;

  const budgetPct =
    key.budgetUsd > 0 ? Math.min(100, (key.spentUsd / key.budgetUsd) * 100) : 100;
  const overBudget = key.spentUsd >= key.budgetUsd;

  const meters = [
    {
      id: "requests",
      label: "Requests",
      value: formatTokens(totals.requests),
      description: "Total API requests made with this key.",
    },
    {
      id: "input",
      label: "Input tokens",
      value: formatTokens(totals.promptTokens),
      description: "Prompt tokens consumed across all requests.",
    },
    {
      id: "output",
      label: "Output tokens",
      value: formatTokens(totals.completionTokens),
      description: "Completion tokens generated across all requests.",
    },
    {
      id: "spent",
      label: "Spent",
      value: formatCost(key.spentUsd),
      description: `Of ${formatCost(key.budgetUsd)} budget.`,
    },
  ];

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[18px] font-medium tracking-[-0.01em] text-white">
                {key.name ?? "Temporary key"}
              </h1>
              <StatusBadge status={key.status} />
            </div>
            <p className="mt-1 font-mono text-[12px] text-white/35">
              {key.maskedKey}
              {key.note ? <span className="ml-2 font-sans text-white/25">· {key.note}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] px-3 text-[12px] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onForget}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] px-3 text-[12px] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/80"
            >
              <LogOut className="h-3.5 w-3.5" />
              Change key
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3">
            <p className="text-[12px] text-red-400">{error}</p>
          </div>
        )}

        {/* ── Budget ── */}
        <section className="rounded-lg border border-white/[0.08] bg-[#171717] px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">
                Budget
              </p>
              <p className="mt-2 text-[22px] font-medium leading-none">
                {formatCost(key.remainingUsd)}{" "}
                <span className="text-[13px] font-normal text-white/35">remaining</span>
              </p>
            </div>
            <p className="text-[12px] text-white/40">
              {formatCost(key.spentUsd)} spent of {formatCost(key.budgetUsd)}
            </p>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full transition-all ${overBudget ? "bg-red-400" : "bg-[#3ecf8e]"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          {overBudget && (
            <p className="mt-2 text-[11px] text-red-400">
              Budget exhausted — requests with this key are no longer served.
            </p>
          )}
        </section>

        {/* ── Meters ── */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {meters.map((m) => (
            <MeterCard
              key={m.id}
              label={m.label}
              value={m.value}
              description={m.description}
            />
          ))}
        </section>

        {/* ── Lifecycle ── */}
        <section className="rounded-lg border border-white/[0.08] bg-[#171717] px-5 py-5">
          <h2 className="text-[15px] font-medium text-white">Key lifecycle</h2>
          <p className="mt-0.5 text-[12px] text-white/40">
            The key is valid for {formatDuration(key.durationSeconds)} from its
            first request.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-white/30">Created</dt>
              <dd className="mt-0.5 text-white/70">{formatDate(key.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-white/30">First used</dt>
              <dd className="mt-0.5 text-white/70">
                {key.firstUsedAt ? formatDate(key.firstUsedAt) : "Not yet"}
              </dd>
            </div>
            <div>
              <dt className="text-white/30">Expires</dt>
              <dd className="mt-0.5 text-white/70">
                {key.expiresAt ? formatDate(key.expiresAt) : "After first use"}
              </dd>
            </div>
            <div>
              <dt className="text-white/30">Time left</dt>
              <dd className="mt-0.5 text-white/70">
                {key.status === "disabled" ? (
                  "—"
                ) : key.expiresAt ? (
                  <ExpiryCountdown expiresAt={key.expiresAt} />
                ) : (
                  "Starts on first request"
                )}
              </dd>
            </div>
          </dl>
        </section>

        {/* ── Model breakdown ── */}
        {models.length > 0 && (
          <section>
            <div className="mb-4">
              <h2 className="text-[15px] font-medium text-white">By model</h2>
              <p className="mt-0.5 text-[12px] text-white/40">
                Top models by spend for this key.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-white/[0.08]">
              {models.map((m, i) => (
                <div
                  key={m.model}
                  className={`grid grid-cols-[1fr_auto] items-center gap-2 bg-[#171717] px-4 py-3 sm:grid-cols-[1.6fr_1fr_1fr_0.8fr] ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-white/80">
                      {m.model}
                    </span>
                    <span className="text-[10px] text-white/35">
                      {formatTokens(m.requests)} request{m.requests === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                    {formatTokens(m.promptTokens)} in
                  </span>
                  <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                    {formatTokens(m.completionTokens)} out
                  </span>
                  <span className="whitespace-nowrap text-right text-[12px] font-medium text-white">
                    {formatCost(m.cost)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Request logs ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-white">Request logs</h2>
            <p className="mt-0.5 text-[12px] text-white/40">
              Every API call made with this key — newest first, times in WITA.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/[0.08]">
            {/* Header row (desktop) */}
            <div className="hidden gap-2 border-b border-white/[0.06] bg-[#171717] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/25 sm:grid sm:grid-cols-[1.8fr_1fr_1fr_0.9fr]">
              <span>Model</span>
              <span className="text-right">Input</span>
              <span className="text-right">Output</span>
              <span className="text-right">Cost</span>
            </div>

            {logs.length === 0 ? (
              <div className="bg-[#171717] px-4 py-10 text-center text-[13px] text-white/30">
                No requests yet — usage will appear here once the key is used.
              </div>
            ) : (
              logs.map((log) => {
                return (
                  <div
                    key={log.id}
                    className="border-b border-white/[0.04] bg-[#171717] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.02] sm:grid sm:grid-cols-[1.8fr_1fr_1fr_0.9fr] sm:items-center sm:gap-2"
                  >
                    {/* Model + provider + time */}
                    <div className="min-w-0">
                      <span className="block truncate text-[12px] font-medium text-white/80">
                        {log.model ?? "—"}
                      </span>
                      <span className="text-[10px] text-white/35">
                        {log.provider ?? "—"} · {formatDate(log.timestamp)}
                        {log.cachedTokens > 0 && (
                          <> · {formatTokens(log.cachedTokens)} cached</>
                        )}
                      </span>
                    </div>

                    {/* Mobile: tokens + cost inline */}
                    <div className="mt-1.5 flex items-center justify-between gap-2 sm:hidden">
                      <span className="font-mono text-[11px] text-white/55">
                        {formatTokens(log.promptTokens)} in ·{" "}
                        {formatTokens(log.completionTokens)} out
                      </span>
                      <span className="text-[12px] font-medium text-white">
                        {formatCost(log.cost)}
                      </span>
                    </div>

                    {/* Desktop columns */}
                    <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                      {formatTokens(log.promptTokens)} tok
                    </span>
                    <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                      {formatTokens(log.completionTokens)} tok
                    </span>
                    <span className="hidden whitespace-nowrap text-right text-[12px] font-medium text-white sm:block">
                      {formatCost(log.cost)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {logs.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-[12px] text-white/40">
              <button
                type="button"
                onClick={() => onChangePage(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 disabled:pointer-events-none disabled:opacity-30"
              >
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => onChangePage(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 disabled:pointer-events-none disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Root client component                                                      */
/* -------------------------------------------------------------------------- */

export default function ConsoleClient() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [data, setData] = useState<ConsoleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "restoring a stored key" from first paint so the gate
  // doesn't flash before the stored key has been checked.
  const [restoring, setRestoring] = useState(true);
  // Tracks whether a dashboard is already showing, so a failed refresh keeps
  // the current view instead of kicking the user back to the key gate.
  const hasDataRef = useRef(false);

  const load = useCallback(async (key: string, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUsage(key, page);
      setData(result);
      setApiKey(key);
      hasDataRef.current = true;
      sessionStorage.setItem(STORAGE_KEY, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      if (!hasDataRef.current) {
        setApiKey(null);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore a key persisted earlier in this tab. Runs async so state updates
  // land after the effect body, keeping the initial render cascade-free.
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      await Promise.resolve();
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        await load(stored, 1);
      }
      if (!cancelled) setRestoring(false);
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const forget = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    hasDataRef.current = false;
    setApiKey(null);
    setData(null);
    setError(null);
  }, []);

  if (restoring) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <RefreshCw className="h-5 w-5 animate-spin text-white/25" />
      </div>
    );
  }

  if (!apiKey || !data) {
    return <KeyGate onSubmit={(key) => void load(key, 1)} loading={loading} error={error} />;
  }

  return (
    <Dashboard
      data={data}
      loading={loading}
      error={error}
      onRefresh={() => void load(apiKey, data.pagination.page)}
      onChangePage={(page) => void load(apiKey, page)}
      onForget={forget}
    />
  );
}
