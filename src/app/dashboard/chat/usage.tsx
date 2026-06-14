"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Coins,
  Loader2,
  MessageSquare,
  RotateCcw,
  Wrench,
} from "lucide-react";

type UsageStats = {
  totals: {
    responses: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    toolCalls: number;
  };
  daily: Array<{ date: string; responses: number; totalTokens: number }>;
  byModel: Array<{ model: string; responses: number; totalTokens: number }>;
  windowDays: number;
};

const WINDOWS = [7, 30, 90] as const;

export function UsageView() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/usage?days=${days}`);
      if (!res.ok) {
        setError("Couldn’t load usage. Please try again.");
        return;
      }
      const data = (await res.json()) as { stats: UsageStats };
      setStats(data.stats);
    } catch {
      setError("Couldn’t reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" aria-hidden />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="flex max-w-[320px] flex-col items-center gap-3 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-500/30 bg-red-500/[0.06] text-red-300/80">
            <AlertCircle className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-[14px] font-medium text-white">
            Couldn’t load usage
          </p>
          <p className="text-[13px] leading-relaxed text-white/40">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.12] px-3 text-[12px] font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-white/40">Couldn’t load usage.</p>
      </div>
    );
  }

  const { totals } = stats;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
            Usage
          </h2>
          {/* Window selector */}
          <div className="inline-flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.03] p-0.5">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  days === w
                    ? "bg-white/[0.08] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/40">
          Token consumption across all AI responses. Recorded to an append-only
          ledger as each response completes, so totals reflect everything you’ve
          ever generated — deleting a conversation never reduces them.
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {error ? (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2">
            <AlertCircle
              className="h-3.5 w-3.5 shrink-0 text-red-300/80"
              aria-hidden
            />
            <span className="flex-1 text-[12px] text-red-300/90">
              {error} Showing the last loaded data.
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-red-300/70 transition-colors hover:text-red-300"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          </div>
        ) : null}
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={MessageSquare}
            label="Responses"
            value={totals.responses.toLocaleString()}
          />
          <StatCard
            icon={Coins}
            label="Total tokens"
            value={formatCompact(totals.totalTokens)}
            sub={
              totals.responses > 0
                ? `${formatCompact(totals.promptTokens)} in · ${formatCompact(totals.completionTokens)} out`
                : "no data yet"
            }
          />
          <StatCard
            icon={Activity}
            label="Avg / response"
            value={
              totals.responses > 0
                ? formatCompact(Math.round(totals.totalTokens / totals.responses))
                : "0"
            }
            sub="tokens"
          />
          <StatCard
            icon={Wrench}
            label="Tool calls"
            value={totals.toolCalls.toLocaleString()}
          />
        </div>

        {/* Activity chart */}
        <section className="mt-5 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
          <div className="mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5 text-white/40" aria-hidden />
            <h3 className="text-[12px] font-medium text-white/70">
              Responses per day
            </h3>
            <span className="text-[11px] text-white/30">
              last {stats.windowDays} days
            </span>
          </div>
          <ActivityChart daily={stats.daily} />
        </section>

        {/* Breakdowns */}
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <BreakdownCard
            title="Tokens by model"
            empty="No usage recorded yet"
            rows={stats.byModel.map((m) => ({
              label: m.model,
              value: m.totalTokens,
              valueLabel: formatCompact(m.totalTokens),
              hint: `${m.responses} resp`,
            }))}
          />
          <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
            <h3 className="mb-3 text-[12px] font-medium text-white/70">
              Token split
            </h3>
            {totals.totalTokens > 0 ? (
              <TokenSplit
                prompt={totals.promptTokens}
                completion={totals.completionTokens}
              />
            ) : (
              <p className="py-4 text-center text-[12px] text-white/30">
                No usage recorded yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-3.5">
      <div className="flex items-center gap-1.5 text-white/40">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <p className="mt-2 text-[22px] font-medium leading-none tracking-[-0.02em] text-white">
        {value}
      </p>
      {sub ? (
        <p className="mt-1.5 truncate text-[11px] text-white/35">{sub}</p>
      ) : null}
    </div>
  );
}

function ActivityChart({
  daily,
}: {
  daily: Array<{ date: string; responses: number; totalTokens: number }>;
}) {
  const max = useMemo(
    () => Math.max(1, ...daily.map((d) => d.responses)),
    [daily],
  );
  const hasAny = daily.some((d) => d.responses > 0);

  if (!hasAny) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <p className="text-[12px] text-white/30">No activity in this window.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[120px] items-end gap-[2px]">
      {daily.map((d) => {
        const pct = (d.responses / max) * 100;
        const label = `${d.date}: ${d.responses} response${d.responses === 1 ? "" : "s"}${
          d.totalTokens > 0 ? ` · ${formatCompact(d.totalTokens)} tokens` : ""
        }`;
        return (
          <div
            key={d.date}
            className="group relative flex flex-1 items-end"
            style={{ height: "100%" }}
          >
            <div
              className={`w-full rounded-sm transition-colors ${
                d.responses > 0
                  ? "bg-[#3ecf8e]/60 group-hover:bg-[#3ecf8e]"
                  : "bg-white/[0.04]"
              }`}
              style={{ height: `${Math.max(pct, d.responses > 0 ? 4 : 1.5)}%` }}
              title={label}
            />
          </div>
        );
      })}
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ label: string; value: number; valueLabel?: string; hint?: string }>;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
      <h3 className="mb-3 text-[12px] font-medium text-white/70">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-white/30">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.slice(0, 8).map((r) => (
            <li key={r.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/80">
                  {r.label}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-white/50">
                  {r.hint ? (
                    <span className="mr-2 text-white/30">{r.hint}</span>
                  ) : null}
                  {r.valueLabel ?? r.value.toLocaleString()}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[#3ecf8e]/50"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Stacked prompt vs completion token bar with a legend. */
function TokenSplit({
  prompt,
  completion,
}: {
  prompt: number;
  completion: number;
}) {
  const total = Math.max(1, prompt + completion);
  const promptPct = (prompt / total) * 100;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full bg-[#3ecf8e]/70"
          style={{ width: `${promptPct}%` }}
        />
        <div className="h-full flex-1 bg-[#3ecf8e]/30" />
      </div>
      <div className="flex items-center justify-between text-[12px]">
        <span className="flex items-center gap-1.5 text-white/60">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#3ecf8e]/70" />
          Prompt
          <span className="tabular-nums text-white/40">
            {formatCompact(prompt)}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-white/60">
          <span className="inline-block h-2 w-2 rounded-sm bg-[#3ecf8e]/30" />
          Completion
          <span className="tabular-nums text-white/40">
            {formatCompact(completion)}
          </span>
        </span>
      </div>
    </div>
  );
}

/** 1234 → "1.2K", 1500000 → "1.5M". Plain integers below 1000. */
function formatCompact(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
