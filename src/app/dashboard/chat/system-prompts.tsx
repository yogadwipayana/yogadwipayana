"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

export type SystemPrompt = {
  id: string;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const NAME_MAX = 120;
const CONTENT_MAX = 20_000;

export function SystemPromptsView() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/system-prompts");
      if (!res.ok) {
        setLoadError("Couldn’t load prompts. Please try again.");
        return;
      }
      const data = (await res.json()) as { prompts: SystemPrompt[] };
      setPrompts(data.prompts);
    } catch {
      setLoadError("Couldn’t reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(
    async (name: string, content: string): Promise<boolean> => {
      const res = await fetch("/api/system-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { prompt: SystemPrompt };
      setPrompts((prev) => [data.prompt, ...prev]);
      return true;
    },
    [],
  );

  const handleEdit = useCallback(
    async (id: string, name: string, content: string) => {
      const prevList = prompts;
      setMutationError(null);
      setPrompts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name, content } : p)),
      );
      try {
        const res = await fetch(`/api/system-prompts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, content }),
        });
        if (!res.ok) {
          setPrompts(prevList);
          setMutationError("Couldn’t save changes. Please try again.");
        }
      } catch {
        setPrompts(prevList);
        setMutationError("Couldn’t reach the server. Please try again.");
      }
    },
    [prompts],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const prevList = prompts;
      setMutationError(null);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      try {
        const res = await fetch(`/api/system-prompts/${id}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          setPrompts(prevList);
          setMutationError("Couldn’t delete prompt. Please try again.");
        }
      } catch {
        setPrompts(prevList);
        setMutationError("Couldn’t reach the server. Please try again.");
      }
    },
    [prompts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q),
    );
  }, [prompts, search]);

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
            Couldn’t load prompts
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
              System Prompts
            </h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/40">
              {prompts.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
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
                placeholder="Filter prompts…"
                className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16] sm:w-[220px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New prompt
            </button>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/40">
          Reusable instruction blocks you can attach to a conversation. The
          attached prompt is injected after the assistant&apos;s base
          instructions, so it layers on top rather than replacing them.
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {mutationError ? (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/[0.06] px-3 py-2">
            <AlertCircle
              className="h-3.5 w-3.5 shrink-0 text-red-300/80"
              aria-hidden
            />
            <span className="flex-1 text-[12px] text-red-300/90">
              {mutationError}
            </span>
            <button
              type="button"
              onClick={() => setMutationError(null)}
              className="shrink-0 text-[11px] font-medium text-red-300/70 transition-colors hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {/* Create editor */}
        {creating ? (
          <div className="mb-5">
            <PromptEditor
              onCancel={() => setCreating(false)}
              onSave={async (name, content) => {
                const ok = await handleCreate(name, content);
                if (ok) setCreating(false);
                return ok;
              }}
            />
          </div>
        ) : null}

        {/* List */}
        {filtered.length === 0 ? (
          <EmptyState
            hasSearch={search.trim().length > 0}
            onCreate={() => setCreating(true)}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
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

/* -------------------------------------------------------------------------- */
/*  Editor (shared by create + edit)                                          */
/* -------------------------------------------------------------------------- */

function PromptEditor({
  initialName = "",
  initialContent = "",
  onSave,
  onCancel,
}: {
  initialName?: string;
  initialContent?: string;
  onSave: (name: string, content: string) => Promise<boolean> | boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && content.trim().length > 0 && !saving;

  const commit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const ok = await onSave(name.trim(), content.trim());
      if (!ok) setError("Failed to save prompt");
    } catch {
      setError("Failed to save prompt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-3">
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={NAME_MAX}
        placeholder="Prompt name, e.g. “Senior Go reviewer”"
        className="mb-2 w-full rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-medium text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void commit();
          }
          if (e.key === "Escape") onCancel();
        }}
        rows={5}
        maxLength={CONTENT_MAX}
        placeholder="Write the instructions the assistant should follow, e.g. “You are a meticulous Go code reviewer. Focus on concurrency bugs and error handling. Reply in Bahasa Indonesia.”"
        className="w-full resize-y rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/25">
          {error ? (
            <span className="text-red-300/80">{error}</span>
          ) : (
            <>⌘/Ctrl + Enter to save · Esc to cancel</>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center rounded-md border border-white/[0.1] px-3 text-[12px] font-medium text-white/65 transition-colors hover:border-white/[0.18] hover:text-white/90"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!canSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50 disabled:hover:bg-[#3ecf8e]"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="h-3.5 w-3.5" aria-hidden />
            )}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */

function PromptCard({
  prompt,
  onEdit,
  onDelete,
}: {
  prompt: SystemPrompt;
  onEdit: (id: string, name: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <PromptEditor
          initialName={prompt.name}
          initialContent={prompt.content}
          onCancel={() => setEditing(false)}
          onSave={(name, content) => {
            if (name !== prompt.name || content !== prompt.content) {
              onEdit(prompt.id, name, content);
            }
            setEditing(false);
            return true;
          }}
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-white/[0.08] bg-[#171717] px-3 py-3">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/45"
      >
        <FileText className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">
          {prompt.name}
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-white/55">
          {prompt.content}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit prompt"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] text-white/60 transition-colors hover:border-white/[0.2] hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(prompt.id)}
          aria-label="Delete prompt"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/30 text-red-300/70 transition-colors hover:border-red-400/50 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function EmptyState({
  hasSearch,
  onCreate,
}: {
  hasSearch: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/40">
        <FileText className="h-4 w-4" aria-hidden />
      </div>
      {hasSearch ? (
        <>
          <p className="text-[14px] font-medium text-white">No matches</p>
          <p className="text-[13px] text-white/40">
            Try a different search term.
          </p>
        </>
      ) : (
        <>
          <p className="text-[14px] font-medium text-white">No prompts yet</p>
          <p className="max-w-[280px] text-[13px] leading-relaxed text-white/40">
            Create a reusable instruction block, then attach it to a
            conversation from the composer.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New prompt
          </button>
        </>
      )}
    </div>
  );
}
