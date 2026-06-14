"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  Loader2,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import type { ChatConversationSummary } from "../data";

/**
 * Archived conversations bin. Lists conversations with `archived_at` set
 * (fetched via `?archived=1`), with actions to unarchive (restore to the active
 * list) or permanently delete. Mirrors MemoryView's layout/styling.
 */
export function ArchivedView() {
  const [items, setItems] = useState<ChatConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/conversations?archived=1");
      if (!res.ok) {
        setLoadError("Couldn’t load archived conversations. Please try again.");
        return;
      }
      const data = (await res.json()) as { conversations: ChatConversationSummary[] };
      setItems(data.conversations);
    } catch {
      setLoadError("Couldn’t reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnarchive = useCallback(async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false }),
      });
      if (!res.ok) setItems(prev);
    } catch {
      setItems(prev);
    }
  }, [items]);

  const handleDelete = useCallback(async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) setItems(prev);
    } catch {
      setItems(prev);
    }
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => c.title.toLowerCase().includes(q));
  }, [items, search]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" aria-hidden />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="flex max-w-[320px] flex-col items-center gap-3 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-500/30 bg-red-500/[0.06] text-red-300/80">
            <AlertCircle className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-[14px] font-medium text-white">
            Couldn’t load archived conversations
          </p>
          <p className="text-[13px] leading-relaxed text-white/40">{loadError}</p>
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
              Archived
            </h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/40">
              {items.length}
            </span>
          </div>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter archived…"
              className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16] sm:w-[220px]"
            />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/40">
          Conversations you’ve archived are hidden from the sidebar but kept
          here. Unarchive to restore one to your active list.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/30">
              <Archive className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-[13px] text-white/40">
              {search.trim().length > 0
                ? "No archived conversations match your search."
                : "No archived conversations."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#171717] px-3 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-white/80">
                  {c.title}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleUnarchive(c.id)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.12] px-2.5 text-[12px] font-medium text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
                  >
                    <Archive className="h-3 w-3" aria-hidden />
                    Unarchive
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.id)}
                    aria-label="Delete conversation"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-300/70 transition-colors hover:bg-red-500/[0.08] hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
