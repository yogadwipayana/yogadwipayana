import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";

import { aiDb } from "@/lib/db/ai";
import { createClient } from "@/utils/supabase/server";
import RangeFilter from "./RangeFilter";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTokens(n: number) {
  return `${new Intl.NumberFormat("en").format(n)} tok`;
}

function formatCost(n: number) {
  return `$${n.toFixed(4)}`;
}

function maskKey(raw: string | null): string {
  if (!raw) return "—";
  const tail = raw.slice(-4);
  return `sk-...${tail}`;
}

/* -------------------------------------------------------------------------- */
/*  Range resolution                                                           */
/* -------------------------------------------------------------------------- */

type ResolvedRange = {
  /** ISO lower bound (inclusive), compared against timestamp strings. */
  fromIso: string;
  /** ISO upper bound (exclusive). */
  toIso: string;
  /** Human label for the overview cards, e.g. "today", "in the last 7 days". */
  scope: string;
};

const PRESET_DAYS: Record<string, number> = { "1d": 1, "1w": 7, "1m": 30 };
const PRESET_SCOPE: Record<string, string> = {
  "1d": "in the last 24 hours",
  "1w": "in the last 7 days",
  "1m": "in the last 30 days",
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function resolveRange(
  range: string,
  from: string | null,
  to: string | null,
): ResolvedRange {
  // Custom range: inclusive of both endpoint days. `to` is bumped one day so
  // the whole "to" date is covered by the exclusive upper bound.
  if (range === "custom" && from && to && DATE_ONLY.test(from) && DATE_ONLY.test(to)) {
    const toExclusive = new Date(`${to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    return {
      fromIso: `${from}T00:00:00.000Z`,
      toIso: toExclusive.toISOString(),
      scope: `from ${from} to ${to}`,
    };
  }

  const key = PRESET_DAYS[range] ? range : "1d";
  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - PRESET_DAYS[key]);

  return {
    fromIso: fromDate.toISOString(),
    toIso: now.toISOString(),
    scope: PRESET_SCOPE[key],
  };
}

/* -------------------------------------------------------------------------- */
/*  Meter card                                                                 */
/* -------------------------------------------------------------------------- */

function MeterCard({
  label,
  valueDisplay,
  description,
}: {
  label: string;
  valueDisplay: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-4">
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p className="mt-2 text-[22px] font-medium leading-none text-white">{valueDisplay}</p>
      <p className="mt-1.5 text-[11px] text-white/30">{description}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export const revalidate = 30;

const PAGE_SIZE = 10;

export default async function AiUsagePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; range?: string; from?: string; to?: string }>;
}) {
  const {
    page: pageParam,
    range: rangeParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const range = rangeParam ?? "1d";
  const { fromIso, toIso, scope } = resolveRange(range, fromParam ?? null, toParam ?? null);

  /* ── Auth ── */
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  /* ── API-key name map — labels only, never gates the data ── */
  // Rows are filtered by usageHistory.owner below. This lookup exists solely to
  // resolve friendly names for the logs "Key" column; usage from since-deleted
  // keys still shows (it simply falls back to the masked raw key).
  const userKeys = email
    ? await aiDb.apiKeys.findMany({
        where: { owner: email },
        select: { key: true, name: true },
      })
    : [];
  const keyNameByValue = new Map(userKeys.map((k) => [k.key, k.name ?? "Untitled key"]));

  /* ── DB queries — only when logged in ── */
  let spentInRange = 0;
  let requestsInRange = 0;
  let tokensInRange = 0;
  let totalCount = 0;
  let rawLogs: Awaited<ReturnType<typeof aiDb.usageHistory.findMany>> = [];

  if (email) {
    const rangeFilter = {
      owner: email,
      timestamp: { gte: fromIso, lt: toIso },
    };

    const [spentResult, reqCount, tokensResult, total, logs] = await Promise.all([
      aiDb.usageHistory.aggregate({
        _sum: { cost: true },
        where: rangeFilter,
      }),
      aiDb.usageHistory.count({
        where: rangeFilter,
      }),
      aiDb.usageHistory.aggregate({
        _sum: { promptTokens: true, completionTokens: true },
        where: rangeFilter,
      }),
      aiDb.usageHistory.count({ where: rangeFilter }),
      aiDb.usageHistory.findMany({
        where: rangeFilter,
        orderBy: { id: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    ]);

    spentInRange = spentResult._sum.cost ?? 0;
    requestsInRange = reqCount;
    tokensInRange =
      (tokensResult._sum.promptTokens ?? 0) +
      (tokensResult._sum.completionTokens ?? 0);
    totalCount = total;
    rawLogs = logs;
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Preserve the active range filter across pagination links.
  function pageHref(target: number): string {
    const qs = new URLSearchParams();
    qs.set("range", range);
    if (range === "custom" && fromParam && toParam) {
      qs.set("from", fromParam);
      qs.set("to", toParam);
    }
    qs.set("page", String(target));
    return `?${qs.toString()}`;
  }

  const isLoggedIn = email !== null;

  const meters = [
    {
      id: "requests",
      label: "Requests",
      valueDisplay: isLoggedIn ? new Intl.NumberFormat("en").format(requestsInRange) : "—",
      description: `Total API requests billed ${scope}.`,
    },
    {
      id: "tokens",
      label: "Tokens",
      valueDisplay: isLoggedIn ? new Intl.NumberFormat("en").format(tokensInRange) : "—",
      description: `Total tokens consumed ${scope}.`,
    },
    {
      id: "spent",
      label: "Spent",
      valueDisplay: isLoggedIn ? formatCost(spentInRange) : "—",
      description: `Total cost billed ${scope} (UTC).`,
    },
  ];

  const hasKeys = userKeys.length > 0;
  const logsEmptyMessage = !isLoggedIn
    ? "Sign in to view request logs."
    : !hasKeys
      ? "No requests yet — generate an API key to start using the AI router."
      : `No requests ${scope}. Try a wider range.`;

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {/* ── Usage meters ── */}
        <section>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-medium text-white">Overview</h2>
              <p className="mt-0.5 text-[12px] text-white/40">
                Usage and credit balance for the selected window.
              </p>
            </div>
            <Suspense
              fallback={
                <div className="h-[30px] w-[140px] rounded-md border border-white/[0.08] bg-[#171717]" />
              }
            >
              <RangeFilter />
            </Suspense>
          </div>

          {/* Sign-in banner */}
          {!isLoggedIn && (
            <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
              <p className="text-[12px] text-white/40">Sign in to see your usage.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 xs:grid-cols-3 sm:grid-cols-3">
            {meters.map((m) => (
              <MeterCard
                key={m.id}
                label={m.label}
                valueDisplay={m.valueDisplay}
                description={m.description}
              />
            ))}
          </div>
        </section>

        {/* ── Request logs ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-[15px] font-medium text-white">Request Logs</h2>
            <p className="mt-0.5 text-[12px] text-white/40">
              API calls {scope} — model, tokens, cost.
            </p>
          </div>

          <div className="space-y-px overflow-hidden rounded-lg border border-white/[0.08]">
            {/* Header row */}
            <div className="hidden gap-2 border-b border-white/[0.06] bg-[#171717] px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-white/25 sm:grid sm:grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr]">
              <span>Model</span>
              <span>Key</span>
              <span className="text-right">Input</span>
              <span className="text-right">Output</span>
              <span className="text-right">Cost</span>
            </div>

            {rawLogs.length === 0 ? (
              <div className="bg-[#171717] px-4 py-10 text-center text-[13px] text-white/30">
                {logsEmptyMessage}
              </div>
            ) : (
              rawLogs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-1 items-center gap-2 border-b border-white/[0.04] bg-[#171717] px-4 py-3 last:border-0 transition-colors hover:bg-white/[0.02] sm:grid-cols-[1.6fr_0.8fr_1fr_1fr_0.8fr]"
                >
                  {/* Model + provider */}
                  <div className="min-w-0">
                    <span className="block truncate text-[12px] font-medium text-white/80">
                      {log.model ?? "—"}
                    </span>
                    <span className="text-[10px] text-white/35">
                      {log.provider ?? "—"} · {formatDate(log.timestamp)}
                    </span>
                  </div>

                  {/* Key (name from apiKeys table; fall back to masked raw if no match) */}
                  <span className="hidden truncate text-[12px] text-white/45 sm:block">
                    {log.apiKey
                      ? (keyNameByValue.get(log.apiKey) ?? maskKey(log.apiKey))
                      : "—"}
                  </span>

                  {/* Input tokens */}
                  <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                    {formatTokens(log.promptTokens ?? 0)}
                  </span>

                  {/* Output tokens */}
                  <span className="hidden whitespace-nowrap text-right font-mono text-[11px] text-white/55 sm:block">
                    {formatTokens(log.completionTokens ?? 0)}
                  </span>

                  {/* Cost */}
                  <span className="hidden whitespace-nowrap text-right text-[12px] font-medium text-white sm:block">
                    {formatCost(log.cost ?? 0)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Pagination — only shown when there are multiple pages */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-[12px] text-white/40">
              <Link
                href={pageHref(page - 1)}
                aria-disabled={page <= 1}
                className={`rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 ${page <= 1 ? "pointer-events-none opacity-30" : ""}`}
              >
                Previous
              </Link>
              <span>{PAGE_SIZE} per page</span>
              <Link
                href={pageHref(page + 1)}
                aria-disabled={page >= totalPages}
                className={`rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70 ${page >= totalPages ? "pointer-events-none opacity-30" : ""}`}
              >
                Next
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
