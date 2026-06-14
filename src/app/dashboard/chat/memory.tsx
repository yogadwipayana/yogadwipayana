"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Brain,
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

type MemorySource = "manual" | "ai";

type ChatMemory = {
  id: string;
  content: string;
  source: MemorySource;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function MemoryView() {
  const [memories, setMemories] = useState<ChatMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/memory");
      if (!res.ok) {
        setLoadError("Couldn’t load memories. Please try again.");
        return;
      }
      const data = (await res.json()) as { memories: ChatMemory[] };
      setMemories(data.memories);
    } catch {
      setLoadError("Couldn’t reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = useCallback(async () => {
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? "Failed to save memory");
        return;
      }
      const data = (await res.json()) as { memory: ChatMemory };
      setMemories((prev) => [data.memory, ...prev]);
      setDraft("");
    } catch {
      setError("Failed to save memory");
    } finally {
      setSaving(false);
    }
  }, [draft, saving]);

  const handleToggle = useCallback(
    async (id: string, isActive: boolean) => {
      // Optimistic
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: isActive } : m)),
      );
      try {
        const res = await fetch("/api/memory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, is_active: isActive }),
        });
        if (!res.ok) {
          setMemories((prev) =>
            prev.map((m) => (m.id === id ? { ...m, is_active: !isActive } : m)),
          );
          setError("Couldn’t update memory. Please try again.");
        }
      } catch {
        setMemories((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_active: !isActive } : m)),
        );
        setError("Couldn’t reach the server. Please try again.");
      }
    },
    [],
  );

  const handleEdit = useCallback(async (id: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const prevList = memories;
    setMemories((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: trimmed } : m)),
    );
    try {
      const res = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content: trimmed }),
      });
      if (!res.ok) {
        setMemories(prevList);
        setError("Couldn’t save the edit. Please try again.");
      }
    } catch {
      setMemories(prevList);
      setError("Couldn’t reach the server. Please try again.");
    }
  }, [memories]);

  const handleDelete = useCallback(async (id: string) => {
    const prevList = memories;
    setMemories((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memory?id=${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setMemories(prevList);
        setError("Couldn’t delete memory. Please try again.");
      }
    } catch {
      setMemories(prevList);
      setError("Couldn’t reach the server. Please try again.");
    }
  }, [memories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memories;
    return memories.filter((m) => m.content.toLowerCase().includes(q));
  }, [memories, search]);

  const activeCount = useMemo(
    () => memories.filter((m) => m.is_active).length,
    [memories],
  );

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
            Couldn’t load memories
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
      {/* Header */}
      <header className="shrink-0 border-b border-white/[0.06] px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">
              Memory
            </h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/40">
              {activeCount} active
            </span>
          </div>
          {/* Search */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter memories…"
              className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16] sm:w-[220px]"
            />
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/40">
          Durable facts and preferences the assistant applies to every
          conversation. Active entries are injected into the system prompt on
          each message.
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {/* Composer */}
        <div className="mb-5 rounded-lg border border-white/[0.08] bg-[#171717] p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder="Add a memory, e.g. “I deploy with Docker on Tencent Lighthouse” or “Always reply in Bahasa Indonesia”."
            className="w-full resize-y rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-white/25">
              {error ? (
                <span className="text-red-300/80">{error}</span>
              ) : (
                <>⌘/Ctrl + Enter to save</>
              )}
            </span>
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || draft.trim().length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50 disabled:hover:bg-[#3ecf8e]"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden />
              )}
              Add memory
            </button>
          </div>
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState hasSearch={search.trim().length > 0} />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MemoryCard({
  memory,
  onToggle,
  onEdit,
  onDelete,
}: {
  memory: ChatMemory;
  onToggle: (id: string, isActive: boolean) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory.content);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== memory.content) {
      onEdit(memory.id, trimmed);
    } else {
      setDraft(memory.content);
    }
    setEditing(false);
  };

  return (
    <li
      className={`group flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
        memory.is_active
          ? "border-white/[0.08] bg-[#171717]"
          : "border-white/[0.05] bg-white/[0.01] opacity-60"
      }`}
    >
      {/* Active toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={memory.is_active}
        aria-label={memory.is_active ? "Deactivate memory" : "Activate memory"}
        onClick={() => onToggle(memory.id, !memory.is_active)}
        className={`mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          memory.is_active ? "bg-[#3ecf8e]" : "bg-white/[0.12]"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white transition-transform ${
            memory.is_active ? "translate-x-3" : "translate-x-0"
          }`}
        />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setDraft(memory.content);
                setEditing(false);
              }
            }}
            onBlur={commit}
            rows={2}
            maxLength={2000}
            className="w-full resize-y rounded-md border border-white/[0.12] bg-white/[0.02] px-2.5 py-1.5 text-[13px] leading-relaxed text-white outline-none focus:border-white/[0.2]"
          />
        ) : (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-white/85">
            {memory.content}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
              memory.source === "ai"
                ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]/90"
                : "border-white/[0.08] bg-white/[0.04] text-white/45"
            }`}
          >
            {memory.source === "ai" ? (
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
            ) : (
              <Brain className="h-2.5 w-2.5" aria-hidden />
            )}
            {memory.source === "ai" ? "AI" : "Manual"}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {editing ? (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commit();
            }}
            aria-label="Save edit"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] text-white/70 transition-colors hover:border-[#3ecf8e]/40 hover:text-[#3ecf8e]"
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(memory.content);
              setEditing(true);
            }}
            aria-label="Edit memory"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] text-white/60 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(memory.id)}
          aria-label="Delete memory"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/30 text-red-300/70 transition-colors hover:border-red-400/50 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/40">
        <Brain className="h-4 w-4" aria-hidden />
      </div>
      {hasSearch ? (
        <>
          <p className="text-[14px] font-medium text-white">No matches</p>
          <p className="text-[13px] text-white/40">Try a different search term.</p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-medium text-white">No memories yet</p>
          <p className="max-w-[280px] text-[13px] leading-relaxed text-white/40">
            Add facts above, or just tell the assistant to remember something in
            a conversation.
          </p>
        </>
      )}
    </div>
  );
}
