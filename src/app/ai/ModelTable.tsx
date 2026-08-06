"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Search,
  Waypoints,
  X,
} from "lucide-react";

import { ProviderIcon } from "@/components/ui/ProviderIcons";
import { ModelIdCopy } from "./ModelIdCopy";

export type PricingModel = {
  name: string;
  id: string;
  provider: string;
  /** Context window in tokens. */
  context: number;
  /** USD per million input tokens; null when the rate follows `fallback`. */
  input: number | null;
  /** USD per million output tokens; null when the rate follows `fallback`. */
  output: number | null;
  available: boolean;
  /** Display names of the models a fallback combo tries, in order. */
  fallback?: readonly string[];
};

/* -------------------------------------------------------------------------- */
/*  Sorting                                                                    */
/* -------------------------------------------------------------------------- */

type SortKey = "default" | "name" | "context" | "input" | "output" | "status";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

const DEFAULT_SORT: Sort = { key: "default", dir: "asc" };

/**
 * Direction a column starts in when first clicked — cheapest-first for prices,
 * biggest-first for context, available-first for status.
 */
const INITIAL_DIR: Record<SortKey, SortDir> = {
  default: "asc",
  name: "asc",
  context: "desc",
  input: "asc",
  output: "asc",
  status: "desc",
};

/** Options for the mobile-friendly select; kept in sync with header clicks. */
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "default:asc", label: "Default order" },
  { value: "name:asc", label: "Name A–Z" },
  { value: "name:desc", label: "Name Z–A" },
  { value: "context:desc", label: "Context: high → low" },
  { value: "context:asc", label: "Context: low → high" },
  { value: "input:asc", label: "Input price: low → high" },
  { value: "input:desc", label: "Input price: high → low" },
  { value: "output:asc", label: "Output price: low → high" },
  { value: "output:desc", label: "Output price: high → low" },
  { value: "status:desc", label: "Available first" },
];

/** Ascending comparison for a key; direction is applied by the caller. */
function compareBy(a: PricingModel, b: PricingModel, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "context":
      return a.context - b.context;
    case "input":
      return (a.input ?? 0) - (b.input ?? 0);
    case "output":
      return (a.output ?? 0) - (b.output ?? 0);
    case "status":
      return Number(a.available) - Number(b.available);
    default:
      return 0;
  }
}

/**
 * Rows with no rate of their own (the fallback combo) sort after priced rows
 * on price columns, in both directions — they have no place on a cheap-to-
 * expensive scale.
 */
function unpricedRank(model: PricingModel, key: SortKey): number {
  if (key !== "input" && key !== "output") return 0;
  return model[key] === null ? 1 : 0;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

// Explicit locale so the server and client render identical strings. Prices
// keep a third decimal when one exists (e.g. $0.435) instead of rounding it off.
const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

const formatUsd = (value: number) => usdFormatter.format(value);
const formatTokens = (value: number) => value.toLocaleString("en-US");

/* -------------------------------------------------------------------------- */
/*  Controls                                                                   */
/* -------------------------------------------------------------------------- */

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-[#171717] py-2.5 pl-3 pr-8 text-[13px] text-white/80 transition-colors [color-scheme:dark] hover:border-white/15 focus:border-[#3ecf8e]/40 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
        aria-hidden
      />
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  alignRight,
}: {
  label: ReactNode;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  alignRight?: boolean;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`group inline-flex items-center gap-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#3ecf8e]/40 ${
        alignRight ? "flex-row-reverse" : ""
      } ${active ? "text-white/80" : "hover:text-white/70"}`}
    >
      {/* One flex item so `flex-row-reverse` only swaps label and icon. */}
      <span>{label}</span>
      <Icon
        className={`h-3.5 w-3.5 shrink-0 transition-colors ${
          active ? "text-[#3ecf8e]" : "text-white/20 group-hover:text-white/45"
        }`}
        aria-hidden
      />
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table                                                                      */
/* -------------------------------------------------------------------------- */

export function ModelTable({ models }: { models: PricingModel[] }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);

  // Catalogue order, deduplicated — keeps the filter list in sync with the data.
  const providerOptions = useMemo(
    () => [
      { value: "all", label: "All providers" },
      ...[...new Set(models.map((m) => m.provider))].map((p) => ({
        value: p,
        label: p,
      })),
    ],
    [models],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = models.filter((model) => {
      if (provider !== "all" && model.provider !== provider) return false;
      if (availableOnly && !model.available) return false;
      if (needle === "") return true;
      return (
        model.name.toLowerCase().includes(needle) ||
        model.id.toLowerCase().includes(needle) ||
        model.provider.toLowerCase().includes(needle)
      );
    });

    if (sort.key === "default") return filtered;
    // Array.sort is stable, so ties keep catalogue order.
    return [...filtered].sort((a, b) => {
      const unpriced = unpricedRank(a, sort.key) - unpricedRank(b, sort.key);
      if (unpriced !== 0) return unpriced;
      const result = compareBy(a, b, sort.key);
      return sort.dir === "asc" ? result : -result;
    });
  }, [models, query, provider, availableOnly, sort]);

  const isFiltered = query !== "" || provider !== "all" || availableOnly;
  const isSorted = sort.key !== "default";

  function handleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: INITIAL_DIR[key] },
    );
  }

  function reset() {
    setQuery("");
    setProvider("all");
    setAvailableOnly(false);
    setSort(DEFAULT_SORT);
  }

  function ariaSort(key: SortKey) {
    if (sort.key !== key) return "none" as const;
    return sort.dir === "asc" ? ("ascending" as const) : ("descending" as const);
  }

  return (
    <>
      {/* Controls */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#171717] px-3 py-2.5 transition-colors focus-within:border-[#3ecf8e]/40 lg:flex-1">
          <Search className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search model, ID, or provider…"
            aria-label="Search models"
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="-mr-1 shrink-0 rounded p-1 text-white/30 transition-colors hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:flex lg:shrink-0">
          <SelectField
            label="Filter by provider"
            value={provider}
            onChange={setProvider}
            options={providerOptions}
          />
          <SelectField
            label="Sort models"
            value={`${sort.key}:${sort.dir}`}
            onChange={(value) => {
              const [key, dir] = value.split(":");
              setSort({ key: key as SortKey, dir: dir as SortDir });
            }}
            options={SORT_OPTIONS}
          />
          <button
            type="button"
            onClick={() => setAvailableOnly((v) => !v)}
            aria-pressed={availableOnly}
            className={`col-span-2 rounded-lg border px-3 py-2.5 text-[13px] transition-colors lg:col-auto ${
              availableOnly
                ? "border-[#3ecf8e]/25 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                : "border-white/[0.08] bg-[#171717] text-white/60 hover:border-white/15 hover:text-white/80"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  availableOnly ? "bg-[#3ecf8e]" : "bg-white/30"
                }`}
              />
              Available only
            </span>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-white/35">
        <span aria-live="polite">
          {visible.length} of {models.length} models
        </span>
        {(isFiltered || isSorted) && (
          <button
            type="button"
            onClick={reset}
            className="rounded text-white/45 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white"
          >
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
        <table className="w-full table-fixed text-left text-[13px] sm:text-sm">
          <thead>
            <tr className="border-b border-white/[0.08] text-white/40">
              <th
                aria-sort={ariaSort("name")}
                className="w-[30%] px-4 py-3 font-medium sm:w-[24%] sm:px-5"
              >
                <SortHeader
                  label="Model"
                  sortKey="name"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th className="w-[26%] px-4 py-3 font-medium sm:w-[22%] sm:px-5">
                Model ID
              </th>
              <th
                aria-sort={ariaSort("context")}
                className="hidden w-[16%] px-5 py-3 font-medium sm:table-cell"
              >
                <SortHeader
                  label="Context"
                  sortKey="context"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th
                aria-sort={ariaSort("input")}
                className="w-[24%] px-4 py-3 text-right font-medium sm:w-[20%] sm:px-5"
              >
                <SortHeader
                  alignRight
                  label={
                    <>
                      In / Out
                      <span className="text-white/25"> /M</span>
                    </>
                  }
                  sortKey="input"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
              <th
                aria-sort={ariaSort("status")}
                className="w-[20%] px-4 py-3 text-right font-medium sm:w-[18%] sm:px-5"
              >
                <SortHeader
                  alignRight
                  label="Status"
                  sortKey="status"
                  sort={sort}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((model) => (
              <tr
                key={model.id}
                className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.02]"
              >
                <td
                  className="px-4 py-3.5 font-medium text-white sm:px-5"
                  title={
                    model.fallback
                      ? `Tries ${model.fallback.join(", then ")}`
                      : undefined
                  }
                >
                  <span className="flex items-center gap-2.5">
                    {model.fallback ? (
                      <Waypoints
                        className="h-4 w-4 shrink-0 text-[#3ecf8e]"
                        aria-hidden
                      />
                    ) : (
                      <ProviderIcon
                        provider={model.provider}
                        className={`h-4 w-4 shrink-0 ${
                          model.provider === "Anthropic" ? "" : "text-white/80"
                        }`}
                      />
                    )}
                    <span>
                      {model.name}
                      <span className="mt-0.5 block text-[12px] font-normal text-white/40">
                        {model.provider}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3.5 sm:px-5">
                  <ModelIdCopy id={model.id} />
                </td>
                <td className="hidden px-5 py-3.5 text-white/60 sm:table-cell">
                  {formatTokens(model.context)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-white/60 sm:px-5">
                  {model.input === null || model.output === null ? (
                    <span className="font-sans text-[12px] text-white/35">
                      rate of model used
                    </span>
                  ) : (
                    <>
                      {formatUsd(model.input)} / {formatUsd(model.output)}
                    </>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right sm:px-5">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-[12px] ${
                      model.available
                        ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                        : "border-white/[0.08] bg-white/[0.03] text-white/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full ${
                        model.available ? "bg-[#3ecf8e]" : "bg-white/30"
                      }`}
                    />
                    {model.available ? "Available" : "Not available"}
                  </span>
                </td>
              </tr>
            ))}

            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center sm:px-5">
                  <p className="text-[13px] text-white/40">
                    No models match these filters.
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-2 text-[13px] text-[#3ecf8e] underline decoration-[#3ecf8e]/30 underline-offset-2 transition-colors hover:decoration-[#3ecf8e]"
                  >
                    Clear filters
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
