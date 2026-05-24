"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Plus,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import {
  ASPECT_RATIO_OPTIONS,
  type AspectRatioPreset,
} from "@/lib/aspect-ratio";
import type { GeneratedImageRow } from "@/lib/server/image-service";

export type GenerateArgs = {
  prompt: string;
  aspect: AspectRatioPreset;
  imageUrls?: string[]; // up to 4 reference images
};

const MAX_REFS = 4;

const ACCEPTED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_REF_BYTES = 50 * 1024 * 1024;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ImageWorkspace({
  initialImages,
  selectedImageId,
  isPending = false,
  pendingPrompt,
  pendingCreatedAt,
  onGenerate,
  onCancelPending,
}: {
  initialImages: GeneratedImageRow[];
  /** When set, the workspace pre-selects this image on mount. */
  selectedImageId?: string;
  /** True when the currently active item is an in-flight generation. */
  isPending?: boolean;
  /** The prompt that was submitted for the pending generation. */
  pendingPrompt?: string;
  /** ISO timestamp of when the pending generation started. */
  pendingCreatedAt?: string;
  /** Called when the user clicks Generate — shell owns the actual fetch. */
  onGenerate: (args: GenerateArgs) => void;
  /** Called when the user cancels an in-flight generation. */
  onCancelPending?: () => void;
}) {
  const initialSelected = selectedImageId
    ? (initialImages.find((i) => i.id === selectedImageId) ?? initialImages[0] ?? null)
    : null;
  const [prompt, setPrompt] = useState(initialSelected?.prompt ?? "");
  const [aspect, setAspect] = useState<AspectRatioPreset>("square");
  // Multiple reference images (up to MAX_REFS). Pre-populated with the viewed
  // image so editing a generation carries the style forward automatically.
  const [referenceUrls, setReferenceUrls] = useState<string[]>(
    initialSelected?.url ? [initialSelected.url] : [],
  );
  const [addUrlInput, setAddUrlInput] = useState("");
  const [showAddInput, setShowAddInput] = useState(false);
  const [refUploading, setRefUploading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [current, setCurrent] = useState<GeneratedImageRow | null>(initialSelected);
  const [images, setImages] = useState<GeneratedImageRow[]>(initialImages);

  // Elapsed seconds for the pending-generation overlay
  const [elapsed, setElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  // Tick elapsed seconds while this item is pending
  useEffect(() => {
    if (!isPending) {
      setElapsed(0);
      return;
    }
    const startMs = pendingCreatedAt ? new Date(pendingCreatedAt).getTime() : Date.now();
    // Initialise immediately so there's no 1-second gap on mount
    setElapsed(Math.floor((Date.now() - startMs) / 1000));
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isPending, pendingCreatedAt]);

  const handleGenerate = useCallback(() => {
    const trimmed = prompt.trim();
    if (!trimmed || isPending) return;
    onGenerate({
      prompt: trimmed,
      aspect,
      imageUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
    });
    setPrompt("");
  }, [prompt, isPending, aspect, referenceUrls, onGenerate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  const handleSelectHistory = useCallback((img: GeneratedImageRow) => {
    setCurrent(img);
    setPrompt(img.prompt);
    // Replace references with the selected image so further edits stay on-style
    setReferenceUrls([img.url]);
  }, []);

  const handleIterate = useCallback((img: GeneratedImageRow) => {
    setReferenceUrls([img.url]);
    setPrompt("");
    textareaRef.current?.focus();
  }, []);

  const addReference = useCallback((url: string) => {
    setReferenceUrls((prev) =>
      prev.includes(url) || prev.length >= MAX_REFS ? prev : [...prev, url],
    );
  }, []);

  const removeReference = useCallback((url: string) => {
    setReferenceUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const handleUploadRef = useCallback(async (file: File) => {
    if (!ACCEPTED_IMAGE_MIME.includes(file.type)) {
      setRefError("Only PNG, JPEG, WebP, or GIF allowed.");
      return;
    }
    if (file.size > MAX_REF_BYTES) {
      setRefError("File too large (max 50 MB).");
      return;
    }

    setRefError(null);
    setRefUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Upload failed: ${res.status}`);
      }
      const { publicUrl } = (await res.json()) as { publicUrl: string };
      addReference(publicUrl);
      setShowAddInput(false);
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setRefUploading(false);
    }
  }, [addReference]);

  const handleAddUrlCommit = useCallback(() => {
    const trimmed = addUrlInput.trim();
    if (!trimmed) return;
    addReference(trimmed);
    setAddUrlInput("");
    setShowAddInput(false);
    setRefError(null);
  }, [addUrlInput, addReference]);

  const canGenerate = prompt.trim().length > 0 && !isPending;

  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      {/* Main two-column layout */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Canvas */}
        <div className="relative flex-1">
          <div className="relative flex h-[360px] w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717] sm:h-[440px] md:h-[min(560px,calc(100svh-12rem))]">
            {current ? (
              <Image
                src={current.url}
                alt={current.prompt}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="flex flex-col items-center gap-3 text-white/25">
                <Sparkles className="h-10 w-10" aria-hidden />
                <p className="text-[13px]">Your generation will appear here</p>
              </div>
            )}

            {isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#171717]/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[#3ecf8e]" aria-hidden />
                <p className="text-[13px] tabular-nums text-white/60">
                  {elapsed}s
                </p>
              </div>
            )}
          </div>

          {(current ?? pendingPrompt) && !isPending && (
            <p className="mt-2 line-clamp-2 text-[12px] text-white/35">
              {current?.prompt ?? pendingPrompt}
            </p>
          )}
          {isPending && pendingPrompt && (
            <p className="mt-2 line-clamp-2 text-[12px] text-white/35">
              {pendingPrompt}
            </p>
          )}
        </div>

        {/* Controls — same height as canvas on desktop, scrollable body, pinned Generate */}
        <div className="flex w-full flex-col md:w-[320px] md:shrink-0 md:h-[min(560px,calc(100svh-12rem))]">
          <div className="flex h-full flex-col rounded-xl border border-white/[0.08] bg-[#171717]">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-4">
            {/* Prompt */}
            <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
              Prompt
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the image you want to generate…"
              rows={3}
              className="w-full resize-none rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.18] focus:bg-white/[0.05]"
              style={{ minHeight: "80px" }}
            />

            {/* Aspect ratio */}
            <label className="mb-2 mt-4 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
              Aspect ratio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIO_OPTIONS.filter((o) => o.preset !== "auto").map((opt) => (
                <button
                  key={opt.preset}
                  type="button"
                  onClick={() => setAspect(opt.preset)}
                  title={opt.description}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    aspect === opt.preset
                      ? "border-[#3ecf8e]/50 bg-[#3ecf8e]/15 text-[#3ecf8e]"
                      : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-white/[0.16] hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Reference images (up to 4) */}
            <div className="mb-2 mt-4 flex items-center justify-between">
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
                Reference images
                <span className="ml-1 normal-case tracking-normal text-white/25">(optional)</span>
              </label>
              {referenceUrls.length > 0 && (
                <span className="text-[11px] text-white/30">
                  {referenceUrls.length}/{MAX_REFS}
                </span>
              )}
            </div>

            {/* Thumbnail grid */}
            {referenceUrls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {referenceUrls.map((url) => (
                  <div key={url} className="group relative h-14 w-14 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Reference"
                      className="h-full w-full rounded-md object-cover border border-white/[0.08]"
                    />
                    <button
                      type="button"
                      onClick={() => removeReference(url)}
                      aria-label="Remove reference"
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-[#2a2a2a] border border-white/[0.12] text-white/60 hover:text-white group-hover:flex"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add reference controls */}
            {referenceUrls.length < MAX_REFS && (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={refUploading}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white disabled:opacity-50"
                  >
                    {refUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Paperclip className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {refUploading ? "Uploading…" : "Upload"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddInput((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
                  >
                    {referenceUrls.length > 0 ? (
                      <><Plus className="h-3.5 w-3.5" aria-hidden />Add</>
                    ) : (
                      "Paste URL"
                    )}
                  </button>
                </div>

                {showAddInput && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={addUrlInput}
                      onChange={(e) => setAddUrlInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddUrlCommit(); }}
                      placeholder="https://…"
                      className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.18]"
                    />
                    <button
                      type="button"
                      onClick={handleAddUrlCommit}
                      className="inline-flex h-8 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>
            )}

            {refError && (
              <p className="mt-1.5 text-[12px] text-red-400">{refError}</p>
            )}
            </div>{/* end scrollable area */}

            {/* Generate / Cancel — pinned to the bottom of the card */}
            <div className="shrink-0 border-t border-white/[0.06] px-4 pb-4 pt-3">
              {isPending ? (
                <button
                  type="button"
                  onClick={onCancelPending}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] text-[13px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Generate
                  <span className="ml-1 hidden text-[11px] font-normal opacity-60 sm:inline">⌘↵</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* History grid */}
      {images.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
            History
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {images.map((img) => (
              <HistoryThumb
                key={img.id}
                img={img}
                active={current?.id === img.id}
                onSelect={handleSelectHistory}
                onIterate={handleIterate}
              />
            ))}
          </div>
        </section>
      )}

      {/* Hidden file input for reference upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_MIME.join(",")}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUploadRef(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function HistoryThumb({
  img,
  active,
  onSelect,
  onIterate,
}: {
  img: GeneratedImageRow;
  active: boolean;
  onSelect: (img: GeneratedImageRow) => void;
  onIterate: (img: GeneratedImageRow) => void;
}) {
  return (
    <div
      className={`group relative aspect-square cursor-pointer overflow-hidden rounded-lg border transition-colors ${
        active
          ? "border-[#3ecf8e]/60"
          : "border-white/[0.06] hover:border-white/[0.14]"
      }`}
      onClick={() => onSelect(img)}
      role="button"
      tabIndex={0}
      aria-label={img.prompt}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(img);
        }
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.url}
        alt={img.prompt}
        className="h-full w-full object-cover"
        loading="lazy"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 flex flex-col items-start justify-end gap-1 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        <p className="line-clamp-1 w-full text-[10px] text-white/70">
          {formatRelative(img.created_at)}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onIterate(img);
          }}
          className="rounded bg-white/[0.12] px-1.5 py-0.5 text-[10px] font-medium text-white transition-colors hover:bg-[#3ecf8e]/20 hover:text-[#3ecf8e]"
        >
          Iterate
        </button>
      </div>
    </div>
  );
}
