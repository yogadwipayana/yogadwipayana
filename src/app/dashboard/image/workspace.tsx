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

export type Quality = "auto" | "hd";

export type GenerateArgs = {
  prompt: string;
  negativePrompt?: string;
  aspect: AspectRatioPreset;
  quality: Quality;
  imageUrls?: string[]; // up to 4 reference images
};

const MAX_REFS = 4;

// Visual proportional box dimensions (max 28px on longest side)
const ASPECT_VISUALS: Record<string, { w: number; h: number; ratio: string }> = {
  square:    { w: 26, h: 26, ratio: "1:1"  },
  portrait:  { w: 20, h: 26, ratio: "3:4"  },
  landscape: { w: 26, h: 20, ratio: "4:3"  },
  wide:      { w: 28, h: 16, ratio: "16:9" },
  tall:      { w: 16, h: 28, ratio: "9:16" },
};

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
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [aspect, setAspect] = useState<AspectRatioPreset>("square");
  const [quality, setQuality] = useState<Quality>("auto");
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
      negativePrompt: negativePrompt.trim() || undefined,
      aspect,
      quality,
      imageUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
    });
    setPrompt("");
  }, [prompt, negativePrompt, isPending, aspect, quality, referenceUrls, onGenerate]);

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

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-5 overflow-y-auto p-4">

              {/* Prompt */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Prompt</span>
                  <span className={`text-[10px] tabular-nums ${prompt.length > 3800 ? "text-amber-400" : "text-white/20"}`}>
                    {prompt.length}/4000
                  </span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe the image…"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.16] focus:bg-white/[0.05]"
                  style={{ minHeight: "80px" }}
                />
                {/* Negative prompt toggle */}
                <button
                  type="button"
                  onClick={() => setShowNegative((v) => !v)}
                  className="mt-1.5 flex items-center gap-1 text-[11px] text-white/30 transition-colors hover:text-white/60"
                >
                  <Plus className={`h-3 w-3 transition-transform ${showNegative ? "rotate-45" : ""}`} aria-hidden />
                  {showNegative ? "Remove negative prompt" : "Add negative prompt"}
                </button>
                {showNegative && (
                  <textarea
                    value={negativePrompt}
                    onChange={(e) => setNegativePrompt(e.target.value)}
                    placeholder="Things to avoid…"
                    rows={2}
                    className="mt-1.5 w-full resize-none rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-white/70 placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.14]"
                  />
                )}
              </div>

              {/* Aspect ratio — visual proportional boxes */}
              <div>
                <span className="mb-2.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Aspect ratio
                </span>
                <div className="flex items-end gap-1.5">
                  {ASPECT_RATIO_OPTIONS.filter((o) => o.preset !== "auto").map((opt) => {
                    const vis = ASPECT_VISUALS[opt.preset];
                    const active = aspect === opt.preset;
                    return (
                      <button
                        key={opt.preset}
                        type="button"
                        onClick={() => setAspect(opt.preset)}
                        title={opt.description}
                        className={`group flex flex-1 flex-col items-center gap-1.5 rounded-lg border py-2 transition-colors ${
                          active
                            ? "border-[#3ecf8e]/40 bg-[#3ecf8e]/10"
                            : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center justify-center" style={{ width: 28, height: 28 }}>
                          <div
                            className={`rounded-sm border transition-colors ${
                              active ? "border-[#3ecf8e]/70 bg-[#3ecf8e]/10" : "border-white/25 group-hover:border-white/40"
                            }`}
                            style={{ width: vis?.w ?? 24, height: vis?.h ?? 24 }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium tabular-nums ${active ? "text-[#3ecf8e]" : "text-white/40 group-hover:text-white/70"}`}>
                          {vis?.ratio ?? opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quality */}
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Quality
                </span>
                <div className="flex gap-1.5">
                  {(["auto", "hd"] as Quality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuality(q)}
                      className={`flex-1 rounded-lg border py-1.5 text-[12px] font-medium transition-colors ${
                        quality === q
                          ? "border-[#3ecf8e]/40 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                          : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:border-white/[0.14] hover:text-white/70"
                      }`}
                    >
                      {q === "auto" ? "Auto" : "HD"}
                    </button>
                  ))}
                </div>
                {quality === "hd" && (
                  <p className="mt-1.5 text-[11px] text-white/30">Higher detail, may take longer</p>
                )}
              </div>

              {/* Reference images */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                    References
                    <span className="ml-1 normal-case text-white/20">(optional)</span>
                  </span>
                  {referenceUrls.length > 0 && (
                    <span className="text-[10px] text-white/25">{referenceUrls.length}/{MAX_REFS}</span>
                  )}
                </div>

                {referenceUrls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {referenceUrls.map((url) => (
                      <div key={url} className="group relative h-14 w-14 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Reference" className="h-full w-full rounded-lg object-cover border border-white/[0.08]" />
                        <button
                          type="button"
                          onClick={() => removeReference(url)}
                          aria-label="Remove reference"
                          className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full border border-white/[0.12] bg-[#1c1c1c] text-white/50 transition-colors hover:text-white group-hover:flex"
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {referenceUrls.length < MAX_REFS && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={refUploading}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] text-[12px] text-white/50 transition-colors hover:border-white/[0.14] hover:text-white/80 disabled:opacity-40"
                      >
                        {refUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                        {refUploading ? "Uploading…" : "Upload"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddInput((v) => !v)}
                        className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] text-[12px] text-white/50 transition-colors hover:border-white/[0.14] hover:text-white/80"
                      >
                        {referenceUrls.length > 0 ? <><Plus className="h-3.5 w-3.5" />Add</> : "Paste URL"}
                      </button>
                    </div>
                    {showAddInput && (
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          value={addUrlInput}
                          onChange={(e) => setAddUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddUrlCommit(); }}
                          placeholder="https://…"
                          className="min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-[12px] text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.14]"
                        />
                        <button
                          type="button"
                          onClick={handleAddUrlCommit}
                          className="inline-flex h-8 items-center rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 text-[12px] text-white/50 transition-colors hover:border-white/[0.14] hover:text-white/80"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {refError && <p className="mt-1.5 text-[11px] text-red-400">{refError}</p>}
              </div>

            </div>{/* end scrollable body */}

            {/* ── Generate / Cancel — pinned bottom ── */}
            <div className="shrink-0 border-t border-white/[0.06] px-4 pb-4 pt-3">
              {isPending ? (
                <button
                  type="button"
                  onClick={onCancelPending}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] text-[13px] font-medium text-white/60 transition-colors hover:border-white/[0.18] hover:text-white"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden />
                  Cancel generation
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#3ecf8e] text-[13px] font-semibold text-[#0d1f16] transition-colors hover:bg-[#2fc47f] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Generate
                  <kbd className="ml-1 hidden rounded border border-[#0d1f16]/20 bg-[#0d1f16]/10 px-1 py-px font-mono text-[10px] sm:inline">⌘↵</kbd>
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
