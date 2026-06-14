"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Download,
  Loader2,
  Maximize2,
  Paperclip,
  Plus,
  ScanText,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
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
  background?: "auto" | "transparent" | "opaque"; // transparent = bg removal
  maskUrl?: string; // inpaint mask; requires exactly one imageUrl
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

// Style presets append a modifier to the prompt at generate time. Client-only:
// the backend just receives the composed prompt string. `id` "none" means no
// modifier (free-form prompt).
type StylePreset = { id: string; label: string; modifier: string };
const STYLE_PRESETS: StylePreset[] = [
  { id: "none", label: "None", modifier: "" },
  { id: "photo", label: "Photorealistic", modifier: "photorealistic, ultra-detailed, sharp focus, natural lighting, 50mm lens, high dynamic range" },
  { id: "anime", label: "Anime", modifier: "anime style, vibrant cel shading, clean line art, expressive, studio-quality" },
  { id: "3d", label: "3D Render", modifier: "3D render, octane render, physically based materials, soft global illumination, high detail" },
  { id: "digital", label: "Digital Art", modifier: "digital painting, concept art, dramatic lighting, rich color, trending on artstation" },
  { id: "oil", label: "Oil Painting", modifier: "oil painting, visible brush strokes, textured canvas, classical fine-art lighting" },
  { id: "watercolor", label: "Watercolor", modifier: "watercolor painting, soft washes, bleeding pigments, delicate paper texture" },
  { id: "minimal", label: "Minimalist", modifier: "minimalist, clean composition, flat design, lots of negative space, limited palette" },
  { id: "cyberpunk", label: "Cyberpunk", modifier: "cyberpunk, neon-lit, futuristic, moody atmosphere, high contrast, cinematic" },
];

/** Compose the final prompt sent to the model from the raw prompt + style. */
function composePrompt(rawPrompt: string, styleId: string): string {
  const preset = STYLE_PRESETS.find((s) => s.id === styleId);
  if (!preset || !preset.modifier) return rawPrompt;
  return `${rawPrompt}. Style: ${preset.modifier}`;
}

/**
 * Pick the highest-resolution aspect preset matching an image's orientation.
 * Used by "Upscale" to re-generate at the largest size for the same shape.
 * Falls back to the supplied current aspect when dimensions are unknown.
 */
function largestPresetForImage(
  size: string | null,
  fallback: AspectRatioPreset,
): AspectRatioPreset {
  const match = size?.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!match) return fallback;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return fallback;
  if (w === h) return "square";
  return h > w ? "tall" : "wide";
}

const UPSCALE_PHRASE = "high resolution, ultra-detailed, sharp";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function slugifyPrompt(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug || "image";
}

export function ImageWorkspace({
  initialImages,
  selectedImageId,
  isPending = false,
  pendingPrompt,
  pendingCreatedAt,
  onGenerate,
  onDeleteImage,
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
  /** Called when the user deletes the selected image. */
  onDeleteImage?: (id: string) => void;
}) {
  const initialSelected = selectedImageId
    ? (initialImages.find((i) => i.id === selectedImageId) ?? initialImages[0] ?? null)
    : null;
  const [prompt, setPrompt] = useState(initialSelected?.prompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [style, setStyle] = useState<string>("none");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  // True while the hidden file input is awaiting a pick that should feed describe.
  const [describeQueued, setDescribeQueued] = useState(false);
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

  // Elapsed seconds for the pending-generation overlay
  const [elapsed, setElapsed] = useState(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
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
      prompt: composePrompt(trimmed, style),
      negativePrompt: negativePrompt.trim() || undefined,
      aspect,
      quality,
      imageUrls: referenceUrls.length > 0 ? referenceUrls : undefined,
    });
    setPrompt("");
  }, [prompt, style, negativePrompt, isPending, aspect, quality, referenceUrls, onGenerate]);

  // Generate a fresh variation of the current image, reusing it as a reference
  // alongside the prompt/aspect/quality already in state. Pure ref-gen.
  const handleVariation = useCallback(
    (img: GeneratedImageRow) => {
      if (!img.url || isPending) return;
      const base = prompt.trim() || img.prompt;
      onGenerate({
        prompt: composePrompt(base, style),
        negativePrompt: negativePrompt.trim() || undefined,
        aspect,
        quality,
        imageUrls: [img.url],
      });
    },
    [prompt, style, negativePrompt, isPending, aspect, quality, onGenerate],
  );

  // "Upscale" = re-generate from the current image at the largest preset for its
  // orientation with a detail-boosting phrase. Not a lossless upscale.
  const handleUpscale = useCallback(
    (img: GeneratedImageRow) => {
      if (!img.url || isPending) return;
      const base = prompt.trim() || img.prompt;
      const composed = composePrompt(base, style);
      onGenerate({
        prompt: `${composed}. ${UPSCALE_PHRASE}`,
        negativePrompt: negativePrompt.trim() || undefined,
        aspect: largestPresetForImage(img.size, aspect),
        quality: "hd",
        imageUrls: [img.url],
      });
    },
    [prompt, style, negativePrompt, isPending, aspect, onGenerate],
  );

  // One-click background removal via the transparent-background ref-gen path.
  const handleRemoveBackground = useCallback(
    (img: GeneratedImageRow) => {
      if (!img.url || isPending) return;
      onGenerate({
        prompt:
          "Keep the main subject exactly as-is and remove the background entirely, making it fully transparent. Clean cutout, preserve fine edges.",
        aspect,
        quality,
        imageUrls: [img.url],
        background: "transparent",
      });
    },
    [isPending, aspect, quality, onGenerate],
  );

  // Describe a given image URL via the enhance route and load it into the prompt.
  const describeFromUrl = useCallback(
    async (imageUrl: string) => {
      setDescribing(true);
      setEnhanceError(null);
      try {
        const res = await fetch("/api/images/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { prompt?: string };
        if (data.prompt) {
          setPrompt(data.prompt);
          textareaRef.current?.focus();
        } else {
          throw new Error("No description returned");
        }
      } catch (err) {
        setEnhanceError(err instanceof Error ? err.message : "Describe failed");
      } finally {
        setDescribing(false);
      }
    },
    [],
  );

  // Describe button: use the first reference if present, otherwise prompt the
  // user to upload an image which is then described once the upload resolves.
  const handleDescribe = useCallback(() => {
    if (describing || enhancing) return;
    const existing = referenceUrls[0];
    if (existing) {
      void describeFromUrl(existing);
      return;
    }
    setDescribeQueued(true);
    fileInputRef.current?.click();
  }, [describing, enhancing, referenceUrls, describeFromUrl]);

  const handleEnhance = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed || enhancing) return;
    setEnhancing(true);
    setEnhanceError(null);
    try {
      const res = await fetch("/api/images/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { prompt: string };
      if (data.prompt) setPrompt(data.prompt);
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  }, [prompt, enhancing]);

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
    setReferenceUrls(img.url ? [img.url] : []);
  }, []);

  const handleIterate = useCallback((img: GeneratedImageRow) => {
    setReferenceUrls(img.url ? [img.url] : []);
    setPrompt("");
    textareaRef.current?.focus();
  }, []);

  const handleDownload = useCallback(async (img: GeneratedImageRow) => {
    if (!img.url) return;
    try {
      const res = await fetch(img.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const ext = (blob.type.split("/")[1] || "png").split("+")[0];
      a.download = `${slugifyPrompt(img.prompt)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // Fallback: open in a new tab so the user can save manually
      window.open(img.url ?? "#", "_blank", "noopener,noreferrer");
    }
  }, []);

  const handleDelete = useCallback(
    (img: GeneratedImageRow) => {
      if (!onDeleteImage) return;
      const ok = window.confirm("Delete this image? This can't be undone.");
      if (!ok) return;
      onDeleteImage(img.id);
    },
    [onDeleteImage],
  );

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
      if (describeQueued) {
        setDescribeQueued(false);
        void describeFromUrl(publicUrl);
      }
    } catch (err) {
      setRefError(err instanceof Error ? err.message : "Upload failed.");
      setDescribeQueued(false);
    } finally {
      setRefUploading(false);
    }
  }, [addReference, describeQueued, describeFromUrl]);

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
            {current?.url ? (
              <Image
                src={current.url}
                alt={current.prompt}
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                unoptimized
              />
            ) : current?.status === "failed" ? (
              <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center text-white/40">
                <X className="h-10 w-10 text-red-400/70" aria-hidden />
                <p className="text-[13px] text-red-400/90">Generation failed</p>
                {current.error && (
                  <p className="text-[12px] text-white/35">{current.error}</p>
                )}
              </div>
            ) : !isPending ? (
              <div className="flex flex-col items-center gap-3 text-white/25">
                <Sparkles className="h-10 w-10" aria-hidden />
                <p className="text-[13px]">Your generation will appear here</p>
              </div>
            ) : null}

            {isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#171717]/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 animate-spin text-[#3ecf8e]" aria-hidden />
                <p className="text-[13px] tabular-nums text-white/60">
                  {elapsed}s
                </p>
              </div>
            )}

            {current?.url && !isPending && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleVariation(current)}
                  title="Generate a variation from this image"
                  aria-label="Generate variation"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:border-[#3ecf8e]/50 hover:text-[#3ecf8e]"
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleUpscale(current)}
                  title="Regenerate at higher resolution"
                  aria-label="Upscale (regenerate at higher resolution)"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:border-[#3ecf8e]/50 hover:text-[#3ecf8e]"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveBackground(current)}
                  title="Remove background (make transparent)"
                  aria-label="Remove background"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:border-[#3ecf8e]/50 hover:text-[#3ecf8e]"
                >
                  <Scissors className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(current)}
                  title="Download image"
                  aria-label="Download image"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:border-[#3ecf8e]/50 hover:text-[#3ecf8e]"
                >
                  <Download className="h-4 w-4" aria-hidden />
                </button>
                {onDeleteImage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(current)}
                    title="Delete image"
                    aria-label="Delete image"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.12] bg-black/50 text-white/70 backdrop-blur-sm transition-colors hover:border-red-400/50 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
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
                  className="w-full resize-none overflow-y-auto rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[13px] leading-relaxed text-white placeholder:text-white/20 outline-none transition-colors focus:border-white/[0.16] focus:bg-white/[0.05]"
                  style={{ minHeight: "80px", maxHeight: "240px" }}
                />
                {/* Negative prompt toggle + Enhance */}
                <div className="mt-1.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowNegative((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-white/30 transition-colors hover:text-white/60"
                  >
                    <Plus className={`h-3 w-3 transition-transform ${showNegative ? "rotate-45" : ""}`} aria-hidden />
                    {showNegative ? "Remove negative prompt" : "Add negative prompt"}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDescribe}
                      disabled={describing || enhancing}
                      title={
                        referenceUrls.length > 0
                          ? "Describe the reference image into a prompt"
                          : "Upload an image to describe into a prompt"
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-white/50 transition-colors hover:border-[#3ecf8e]/40 hover:text-[#3ecf8e] disabled:opacity-40 disabled:hover:border-white/[0.08] disabled:hover:text-white/50"
                    >
                      {describing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <ScanText className="h-3 w-3" aria-hidden />}
                      {describing ? "Describing…" : "Describe"}
                    </button>
                    <button
                      type="button"
                      onClick={handleEnhance}
                      disabled={!prompt.trim() || enhancing}
                      title="Rewrite your prompt with more detail"
                      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[11px] text-white/50 transition-colors hover:border-[#3ecf8e]/40 hover:text-[#3ecf8e] disabled:opacity-40 disabled:hover:border-white/[0.08] disabled:hover:text-white/50"
                    >
                      {enhancing ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Wand2 className="h-3 w-3" aria-hidden />}
                      {enhancing ? "Enhancing…" : "Enhance"}
                    </button>
                  </div>
                </div>
                {enhanceError && <p className="mt-1 text-[11px] text-red-400">{enhanceError}</p>}
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

              {/* Style presets */}
              <div>
                <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  Style
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((preset) => {
                    const active = style === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setStyle(preset.id)}
                        className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          active
                            ? "border-[#3ecf8e]/40 bg-[#3ecf8e]/10 text-[#3ecf8e]"
                            : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:border-white/[0.14] hover:text-white/70"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
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

            {/* ── Generate — pinned bottom ── */}
            <div className="shrink-0 border-t border-white/[0.06] px-4 pb-4 pt-3">
              {isPending ? (
                <div
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] text-[13px] font-medium text-white/50"
                  title="Generation runs in the background — you can leave this page"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Generating in background…
                </div>
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
      {initialImages.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
            History
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {initialImages.map((img) => (
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
      {img.url ? (
        <>
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
        </>
      ) : img.status === "failed" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/[0.02] text-red-400/70">
          <X className="h-5 w-5" aria-hidden />
          <span className="text-[9px]">Failed</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.02]">
          <Loader2 className="h-5 w-5 animate-spin text-[#3ecf8e]" aria-hidden />
        </div>
      )}
    </div>
  );
}
