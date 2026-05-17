"use client";

import { useState } from "react";

import type { AiRequestLog, AiUsageMeter } from "../../data";
import { AI_REQUEST_LOGS, AI_USAGE_METERS } from "../../data";

/* -------------------------------------------------------------------------- */
/*  Meter card                                                                 */
/* -------------------------------------------------------------------------- */

function MeterCard({ meter }: { meter: AiUsageMeter }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{meter.label}</p>
      <p className="mt-2 text-[22px] font-medium leading-none text-white">{meter.valueDisplay}</p>
      <p className="mt-1.5 text-[11px] text-white/30">{meter.description}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Log row helpers                                                            */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function formatTokens(n: number) {
  return `${new Intl.NumberFormat("en").format(n)} tok`;
}

function statusColor(s: string) {
  if (s === "200") return "text-[#3ecf8e]";
  if (s === "429") return "text-amber-300";
  return "text-red-400";
}


/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const PAGE_SIZE = 8;

export default function AiUsagePage() {
  const [logs] = useState<AiRequestLog[]>(AI_REQUEST_LOGS);
  const [page, setPage] = useState(0);

  const totalPages = Math.ceil(logs.length / PAGE_SIZE);
  const pageItems = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* ── Usage meters ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-white">Overview</h2>
            <p className="mt-0.5 text-[12px] text-white/40">Current window usage and credit balance.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 xs:grid-cols-3 sm:grid-cols-3">
            {AI_USAGE_METERS.map((m) => <MeterCard key={m.id} meter={m} />)}
          </div>
        </section>

        {/* ── Request logs ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-white">Request Logs</h2>
            <p className="mt-0.5 text-[12px] text-white/40">
              Recent API calls — model, tokens, cost, latency.
            </p>
          </div>

          {/* Card list — always visible, clean on any width */}
          <div className="space-y-px overflow-hidden rounded-lg border border-white/[0.08]">
            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/[0.06] bg-[#171717] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/25 sm:grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr_0.6fr_0.5fr]">
              <span>Model</span>
              <span className="hidden sm:block">Key</span>
              <span className="hidden sm:block text-right">Input</span>
              <span className="hidden sm:block text-right">Output</span>
              <span className="hidden sm:block text-right">Cost</span>
              <span className="hidden sm:block text-right">Latency</span>
              <span className="text-right">Status</span>
            </div>

            {pageItems.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-[1fr_auto] items-center gap-2 border-b border-white/[0.04] bg-[#171717] px-4 py-3 last:border-0 hover:bg-white/[0.02] transition-colors sm:grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr_0.6fr_0.5fr]"
              >
                {/* Model + provider */}
                <div className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-white/80">{log.model}</span>
                  <span className="text-[10px] text-white/35">{log.provider} · {formatDate(log.createdAt)}</span>
                </div>

                {/* Key */}
                <span className="hidden truncate text-[12px] text-white/45 sm:block">{log.appLabel ?? "—"}</span>

                {/* Input tokens */}
                <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                  {formatTokens(log.inputTokens)}
                </span>

                {/* Output tokens */}
                <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                  {formatTokens(log.outputTokens)}
                </span>

                {/* Cost */}
                <span className="hidden whitespace-nowrap text-right text-[12px] font-medium text-white sm:block">
                  {log.costDisplay}
                </span>

                {/* Latency */}
                <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/40 sm:block">
                  {log.latencyMs != null ? `${log.latencyMs}ms` : "—"}
                </span>

                {/* Status */}
                <span className={`whitespace-nowrap text-right font-mono text-[12px] font-medium ${statusColor(log.status)}`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[12px] text-white/40">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <span>{PAGE_SIZE} per page</span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-30"
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
