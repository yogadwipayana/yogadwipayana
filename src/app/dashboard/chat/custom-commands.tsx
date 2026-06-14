"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlashSquare,
  Trash2,
} from "lucide-react";

export type CustomSlashCommand = {
  id: string;
  trigger: string;
  description: string;
  content: string;
  created_at: string;
  updated_at: string;
};

const TRIGGER_MAX = 32;
const DESCRIPTION_MAX = 200;
const CONTENT_MAX = 20_000;

export function CustomCommandsView() {
  const [commands, setCommands] = useState<CustomSlashCommand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/custom-slash-commands");
      if (!res.ok) {
        setLoadError("Couldn’t load commands. Please try again.");
        return;
      }
      const data = (await res.json()) as { commands: CustomSlashCommand[] };
      setCommands(data.commands);
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
    async (
      trigger: string,
      description: string,
      content: string,
    ): Promise<string | null> => {
      try {
        const res = await fetch("/api/custom-slash-commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, description, content }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          return data.error ?? "Couldn’t create command.";
        }
        const data = (await res.json()) as { command: CustomSlashCommand };
        setCommands((prev) => [data.command, ...prev]);
        return null;
      } catch {
        return "Couldn’t reach the server.";
      }
    },
    [],
  );

  const handleEdit = useCallback(
    async (id: string, trigger: string, description: string, content: string) => {
      const prevList = commands;
      setMutationError(null);
      setCommands((prev) =>
        prev.map((c) => (c.id === id ? { ...c, trigger, description, content } : c)),
      );
      try {
        const res = await fetch(`/api/custom-slash-commands/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trigger, description, content }),
        });
        if (!res.ok) {
          setCommands(prevList);
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setMutationError(data.error ?? "Couldn’t save changes. Please try again.");
        }
      } catch {
        setCommands(prevList);
        setMutationError("Couldn’t reach the server. Please try again.");
      }
    },
    [commands],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const prevList = commands;
      setMutationError(null);
      setCommands((prev) => prev.filter((c) => c.id !== id));
      try {
        const res = await fetch(`/api/custom-slash-commands/${id}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) {
          setCommands(prevList);
          setMutationError("Couldn’t delete command. Please try again.");
        }
      } catch {
        setCommands(prevList);
        setMutationError("Couldn’t reach the server. Please try again.");
      }
    },
    [commands],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.trigger.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q),
    );
  }, [commands, search]);

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
            Couldn’t load commands
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
              Slash Commands
            </h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/40">
              {commands.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter commands…"
                className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16] sm:w-[220px]"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              New command
            </button>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-white/40">
          Define your own <code className="text-white/60">/trigger</code> shortcuts.
          Typing the trigger injects your instructions for that turn. Built-in
          commands (/summarize, /diagram, /word) always take precedence.
        </p>
      </header>

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

        {creating ? (
          <div className="mb-5">
            <CommandEditor
              onCancel={() => setCreating(false)}
              onSave={async (trigger, description, content) => {
                const err = await handleCreate(trigger, description, content);
                if (!err) setCreating(false);
                return err;
              }}
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            hasSearch={search.trim().length > 0}
            onCreate={() => setCreating(true)}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((c) => (
              <CommandCard
                key={c.id}
                command={c}
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

function CommandEditor({
  initialTrigger = "",
  initialDescription = "",
  initialContent = "",
  onSave,
  onCancel,
}: {
  initialTrigger?: string;
  initialDescription?: string;
  initialContent?: string;
  // Returns an error string on failure, or null on success.
  onSave: (
    trigger: string,
    description: string,
    content: string,
  ) => Promise<string | null> | string | null;
  onCancel: () => void;
}) {
  const [trigger, setTrigger] = useState(initialTrigger);
  const [description, setDescription] = useState(initialDescription);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    triggerRef.current?.focus();
  }, []);

  const triggerValid = /^[a-z]+$/.test(trigger.trim());
  const canSave =
    triggerValid && content.trim().length > 0 && !saving;

  const commit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const err = await onSave(trigger.trim().toLowerCase(), description.trim(), content.trim());
      if (err) setError(err);
    } catch {
      setError("Failed to save command");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[15px] font-medium text-white/40">/</span>
        <input
          ref={triggerRef}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value.toLowerCase())}
          maxLength={TRIGGER_MAX}
          placeholder="trigger"
          className="w-[140px] rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-medium text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          placeholder="Short description (shown in the menu)"
          className="min-w-0 flex-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
        />
      </div>
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
        placeholder="Instructions to apply when this command is used, e.g. “Rewrite the user’s text to be more concise and professional, preserving meaning.”"
        className="w-full resize-y rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16]"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-white/25">
          {error ? (
            <span className="text-red-300/80">{error}</span>
          ) : !triggerValid && trigger.length > 0 ? (
            <span className="text-red-300/80">Trigger must be lowercase letters only</span>
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

function CommandCard({
  command,
  onEdit,
  onDelete,
}: {
  command: CustomSlashCommand;
  onEdit: (id: string, trigger: string, description: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <CommandEditor
          initialTrigger={command.trigger}
          initialDescription={command.description}
          initialContent={command.content}
          onCancel={() => setEditing(false)}
          onSave={(trigger, description, content) => {
            if (
              trigger !== command.trigger ||
              description !== command.description ||
              content !== command.content
            ) {
              onEdit(command.id, trigger, description, content);
            }
            setEditing(false);
            return null;
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
        <SlashSquare className="h-3.5 w-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[#3ecf8e]/90">
          /{command.trigger}
          {command.description ? (
            <span className="ml-2 font-normal text-white/45">
              {command.description}
            </span>
          ) : null}
        </p>
        <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-white/55">
          {command.content}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit command"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] text-white/60 transition-colors hover:border-white/[0.2] hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onDelete(command.id)}
          aria-label="Delete command"
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
        <SlashSquare className="h-4 w-4" aria-hidden />
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
          <p className="text-[14px] font-medium text-white">No commands yet</p>
          <p className="max-w-[280px] text-[13px] leading-relaxed text-white/40">
            Create a <code className="text-white/60">/trigger</code> shortcut, then
            use it from the chat composer.
          </p>
          <button
            type="button"
            onClick={onCreate}
            className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New command
          </button>
        </>
      )}
    </div>
  );
}
