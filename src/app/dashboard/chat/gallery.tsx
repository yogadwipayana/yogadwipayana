"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  Loader2,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react";

type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  model: string;
  size: string | null;
  source_url: string | null;
  source: "chat" | "workspace" | "admin";
  conversation_id: string | null;
  created_at: string;
};

type ImagesResponse = {
  images: GeneratedImage[];
  nextCursor: string | null;
  hasMore: boolean;
};

type SortOrder = "desc" | "asc";

const PAGE_SIZE = 48;

export function GalleryView() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [search, setSearch] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Refs mirror the latest cursor/hasMore so loadMore can stay stable and
  // read current values without re-creating the IntersectionObserver.
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // Initial page load (sync with the images API).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/images?limit=${PAGE_SIZE}`);
        if (!res.ok) return;
        const data = (await res.json()) as ImagesResponse;
        if (cancelled) return;
        setImages(data.images);
        setHasMore(data.hasMore);
        hasMoreRef.current = data.hasMore;
        cursorRef.current = data.nextCursor;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current || cursorRef.current == null) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/images?limit=${PAGE_SIZE}&before=${encodeURIComponent(cursorRef.current)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as ImagesResponse;
      setImages((prev) => {
        const seen = new Set(prev.map((img) => img.id));
        const fresh = data.images.filter((img) => !seen.has(img.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setHasMore(data.hasMore);
      hasMoreRef.current = data.hasMore;
      cursorRef.current = data.nextCursor;
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, []);

  // Auto-load the next page when the sentinel scrolls into view. Re-created
  // when hasMore flips; stops observing once there's nothing more to load.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root: scrollRef.current, rootMargin: "300px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleDelete = useCallback(async (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    try {
      const res = await fetch(`/api/images?id=${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        // Restore on failure — re-fetch the first page to get accurate state.
        const refetch = await fetch(`/api/images?limit=${PAGE_SIZE}`);
        if (refetch.ok) {
          const data = (await refetch.json()) as ImagesResponse;
          setImages(data.images);
          setHasMore(data.hasMore);
          hasMoreRef.current = data.hasMore;
          cursorRef.current = data.nextCursor;
        }
      }
    } catch {
      const refetch = await fetch(`/api/images?limit=${PAGE_SIZE}`);
      if (refetch.ok) {
        const data = (await refetch.json()) as ImagesResponse;
        setImages(data.images);
        setHasMore(data.hasMore);
        hasMoreRef.current = data.hasMore;
        cursorRef.current = data.nextCursor;
      }
    }
  }, []);

  // Search + sort operate over the currently loaded pages only (page-local).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? images.filter((img) => img.prompt.toLowerCase().includes(q))
      : images;
    return [...base].sort((a, b) => {
      const diff =
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "desc" ? -diff : diff;
    });
  }, [images, search, sortOrder]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" aria-hidden />
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
              Image Gallery
            </h2>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/40">
              {images.length}
              {hasMore ? "+" : ""}
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
                placeholder="Filter loaded…"
                className="h-8 w-[180px] rounded-md border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 text-[12px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.16] sm:w-[220px]"
              />
            </div>
            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="h-8 rounded-md border border-white/[0.08] bg-[#171717] px-2.5 text-[12px] text-white/70 outline-none transition-colors hover:border-white/[0.14] focus:border-white/[0.16]"
              aria-label="Sort order"
            >
              <option value="desc">Date: newest</option>
              <option value="asc">Date: oldest</option>
            </select>
          </div>
        </div>
      </header>

      {/* Grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8"
      >
        {filtered.length === 0 ? (
          <EmptyState hasSearch={search.trim().length > 0} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((img) => (
              <ImageCard key={img.id} image={img} onDelete={handleDelete} />
            ))}
          </ul>
        )}

        {/* Infinite-scroll sentinel + loading indicator */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="flex items-center justify-center py-6"
          >
            {loadingMore && (
              <Loader2
                className="h-4 w-4 animate-spin text-white/30"
                aria-hidden
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageCard({
  image,
  onDelete,
}: {
  image: GeneratedImage;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      // Fetch the image as a blob and write it as an actual image to the
      // clipboard so the user can paste it directly into other apps.
      const res = await fetch(image.url);
      const blob = await res.blob();
      const mimeType = blob.type || "image/png";
      // ClipboardItem only accepts png in most browsers; convert if needed.
      const pngBlob: Blob = mimeType === "image/png"
        ? blob
        : await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              canvas.getContext("2d")!.drawImage(img, 0, 0);
              canvas.toBlob((b) => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
          });
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: copy the URL as text if clipboard image API is unavailable
      try {
        await navigator.clipboard.writeText(image.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    setShareError(null);
    try {
      const res = await fetch(`/api/images/${image.id}/share`);
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (!res.ok || !data?.url) {
        setShareError(data?.error || "Couldn't create link");
        setTimeout(() => setShareError(null), 2500);
        return;
      }
      await navigator.clipboard.writeText(data.url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    } catch {
      setShareError("Couldn't create link");
      setTimeout(() => setShareError(null), 2500);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    onDelete(image.id);
  };

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]">
      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-white/[0.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.prompt}
          loading="lazy"
          className="h-full w-full object-cover"
        />

        {/* Share error toast */}
        {shareError && (
          <div className="absolute inset-x-1 top-1 z-10 rounded-md border border-red-500/30 bg-[#171717]/95 px-2 py-1 text-[10px] leading-snug text-red-300">
            {shareError}
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-end justify-end gap-1 bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy image"
            aria-label="Copy image to clipboard"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-[#171717]/80 text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            {copied ? (
              <span className="text-[9px] font-medium text-[#3ecf8e]">✓</span>
            ) : (
              <Copy className="h-3 w-3" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={handleShare}
            title="Copy share link"
            aria-label="Copy share link to clipboard"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-[#171717]/80 text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            {linkCopied ? (
              <span className="text-[9px] font-medium text-[#3ecf8e]">✓</span>
            ) : (
              <Share2 className="h-3 w-3" aria-hidden />
            )}
          </button>
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer noopener"
            title="Open in new tab"
            aria-label="Open image in new tab"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.12] bg-[#171717]/80 text-white/70 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          <button
            type="button"
            onClick={handleDelete}
            title="Delete image"
            aria-label="Delete image"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-500/30 bg-[#171717]/80 text-red-300/70 transition-colors hover:border-red-400/50 hover:text-red-300"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>

      {/* Prompt */}
      <div className="px-2.5 py-2">
        <p className="line-clamp-2 text-[11px] leading-relaxed text-white/50">
          {image.prompt}
        </p>
      </div>
    </li>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/40">
        <Sparkles className="h-4 w-4" aria-hidden />
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
          <p className="text-[14px] font-medium text-white">No images yet</p>
          <p className="max-w-[260px] text-[13px] leading-relaxed text-white/40">
            Generate images in a conversation using image mode or the{" "}
            <span className="font-mono text-white/55">image_generate</span>{" "}
            tool.
          </p>
        </>
      )}
    </div>
  );
}
