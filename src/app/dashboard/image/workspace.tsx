"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Paperclip,
  Sparkles,
  Square,
  X,
} from "lucide-react";

import {
  ASPECT_RATIO_OPTIONS,
  type AspectRatioPreset,
} from "@/lib/aspect-ratio";
import type { GeneratedImageRow } from "@/lib/server/image-service";

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
}: {
  initialImages: GeneratedImageRow[];
}) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatioPreset>("square");
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [refUrlInput, setRefUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [refUploading, setRefUploading] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<GeneratedImageRow | null>(
    initialImages[0] ?? null,
  );
  const [images, setImages] = useState<GeneratedImageRow[]>(initialImages);

  const abortRef = useRef<AbortController | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [prompt]);

  // Tick elapsed seconds while generating. Reset happens in handleGenerate
  // before setIsGenerating(true) so we never call setState inside the effect.
  useEffect(() => {
    if (!isGenerating) {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
      return;
    }
    elapsedRef.current = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);
    return () => {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current);
        elapsedRef.current = null;
      }
    };
  }, [isGenerating]);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;

    setError(null);
    setElapsed(0);
    setIsGenerating(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          aspect_ratio: aspect,
          image_url: referenceUrl ?? undefined,
          source: "workspace",
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { image: GeneratedImageRow };
      setImages((prev) => [data.image, ...prev]);
      setCurrent(data.image);
      setPrompt("");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [prompt, aspect, referenceUrl, isGenerating]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void handleGenerate();
      }
    },
    [handleGenerate],
  );

  const handleSelectHistory = useCallback((img: GeneratedImageRow) => {
    setCurrent(img);
    setPrompt(img.prompt);
  }, []);

  const handleIterate = useCallback((img: GeneratedImageRow) => {
    setReferenceUrl(img.url);
    setRefUrlInput(img.url);
    setPrompt("");
    textareaRef.current?.focus();
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
      const metaRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!metaRes.ok) throw new Error(`Upload init failed: ${metaRes.status}`);
      const meta = (await metaRes.json()) as {
        url: string;
        method: string;
        publicUrl: string;
      };

      await fetch(meta.url, {
        method: meta.method ?? "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setReferenceUrl(meta.publicUrl);
      setRefUrlInput(meta.publicUrl);
      setShowUrlInput(false);
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setRefUploading(false);
    }
  }, []);

  const handleRefUrlCommit = useCallback(() => {
    const trimmed = refUrlInput.trim();
    if (!trimmed) return;
    setReferenceUrl(trimmed);
    setShowUrlInput(false);
    setRefError(null);
  }, [refUrlInput]);

  const clearReference = useCallback(() => {
    setReferenceUrl(null);
    setRefUrlInput("");
    setRefError(null);
    setShowUrlInput(false);
  }, []);

  const canGenerate = prompt.trim().length > 0 && !isGenerating;

  return (
    <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
      {/* Main two-column layout */}
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Canvas */}
        <div className="relative flex-1">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
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

            {isGenerating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#171717]/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[#3ecf8e]" aria-hidden />
                <p className="text-[13px] tabular-nums text-white/60">
                  {elapsed}s
                </p>
              </div>
            )}
          </div>

          {current && !isGenerating && (
            <p className="mt-2 line-clamp-2 text-[12px] text-white/35">
              {current.prompt}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex w-full flex-col gap-4 md:w-[320px] md:shrink-0">
          <div className="rounded-xl border border-white/[0.08] bg-[#171717] p-4">
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

            {/* Reference image */}
            <label className="mb-2 mt-4 block text-[11px] font-medium uppercase tracking-[0.1em] text-white/40">
              Reference image
              <span className="ml-1 normal-case tracking-normal text-white/25">(optional)</span>
            </label>

            {referenceUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referenceUrl}
                  alt="Reference"
                  className="h-10 w-10 shrink-0 rounded object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[12px] text-white/50">
                  {referenceUrl.split("/").pop()}
                </span>
                <button
                  type="button"
                  onClick={clearReference}
                  aria-label="Remove reference image"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : (
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
                    onClick={() => setShowUrlInput((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
                  >
                    Paste URL
                  </button>
                </div>

                {showUrlInput && (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={refUrlInput}
                      onChange={(e) => setRefUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRefUrlCommit();
                      }}
                      placeholder="https://…"
                      className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.18]"
                    />
                    <button
                      type="button"
                      onClick={handleRefUrlCommit}
                      className="inline-flex h-8 items-center rounded-md border border-white/[0.08] bg-white/[0.03] px-3 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
                    >
                      Set
                    </button>
                  </div>
                )}
              </div>
            )}

            {refError && (
              <p className="mt-1.5 text-[12px] text-red-400">{refError}</p>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300/85">
                {error}
              </div>
            )}

            {/* Generate / Cancel */}
            <div className="mt-4">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.04] text-[13px] font-medium text-white/70 transition-colors hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
                >
                  <Square className="h-3.5 w-3.5" aria-hidden />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={!canGenerate}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#3ecf8e] text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Generate
                  <span className="ml-1 text-[11px] font-normal opacity-60">⌘↵</span>
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
