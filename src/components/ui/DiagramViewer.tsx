"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  Code2,
  ImageDown,
  Maximize2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { copyToClipboard } from "@/lib/utils";

const MIN_SCALE = 0.25;
const MAX_SCALE = 8;

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

// Rasterize an inline <svg> element to a PNG blob. We clone the live node (so it
// reflects the themed, fully laid-out diagram) and stamp explicit pixel
// dimensions, since Mermaid/Graphviz SVGs often size via viewBox + max-width and
// would otherwise rasterize to a 0-sized or blurry image.
async function svgElementToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const rect = svg.getBoundingClientRect();
  let width = rect.width;
  let height = rect.height;

  const viewBox = svg.viewBox?.baseVal;
  if ((!width || !height) && viewBox && viewBox.width && viewBox.height) {
    width = viewBox.width;
    height = viewBox.height;
  }
  if (!width || !height) {
    width = 800;
    height = 600;
  }

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (viewBox && viewBox.width && viewBox.height) {
    clone.setAttribute(
      "viewBox",
      `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    );
  }

  const serialized = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load SVG for export"));
      img.src = url;
    });

    const dpr =
      typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 3) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.fillStyle = "#0f0f0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode PNG"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type CopyKind = "svg" | "png";

export function DiagramViewer({
  svg,
  kind,
}: {
  svg: string;
  kind: "mermaid" | "graphviz";
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  // Re-center whenever the diagram source changes — adjusted during render via
  // the previous-prop state pattern (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes).
  const [prevSvg, setPrevSvg] = useState(svg);
  if (prevSvg !== svg) {
    setPrevSvg(svg);
    setScale(1);
    setTx(0);
    setTy(0);
  }

  const zoomBy = useCallback((factor: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      setScale((s) => clampScale(s * factor));
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setScale((prev) => {
      const next = clampScale(prev * factor);
      const ratio = next / prev;
      setTx((x) => cx - ratio * (cx - x));
      setTy((y) => cy - ratio * (cy - y));
      return next;
    });
  }, []);

  // Native wheel listener so we can preventDefault (React's onWheel is passive).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);
      setScale((prev) => {
        const next = clampScale(prev * factor);
        const ratio = next / prev;
        setTx((x) => cx - ratio * (cx - x));
        setTy((y) => cy - ratio * (cy - y));
        return next;
      });
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    setTx((x) => x + dx);
    setTy((y) => y + dy);
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const flagCopied = (which: CopyKind) => {
    setCopied(which);
    window.setTimeout(() => {
      setCopied((cur) => (cur === which ? null : cur));
    }, 1500);
  };

  const copySvg = useCallback(async () => {
    const ok = await copyToClipboard(svg);
    if (ok) flagCopied("svg");
  }, [svg]);

  const copyPng = useCallback(async () => {
    const node = contentRef.current?.querySelector("svg");
    if (!node) return;
    try {
      const blob = await svgElementToPngBlob(node as SVGSVGElement);
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      } else {
        // Clipboard image write unsupported — fall back to a download.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${kind}-diagram.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
      flagCopied("png");
    } catch {
      // Swallow — export is best-effort and the diagram itself still renders.
    }
  }, [kind]);

  const btn =
    "flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-[#171717]/80 text-white/60 backdrop-blur transition hover:border-white/20 hover:text-white/90 active:scale-95";

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0f0f0f]">
      <div className="pointer-events-none absolute right-2 top-2 z-10 flex gap-1 opacity-70 transition-opacity group-hover:opacity-100">
        <div className="pointer-events-auto flex gap-1">
          <button type="button" className={btn} onClick={() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={() => zoomBy(0.8)} aria-label="Zoom out" title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={reset} aria-label="Reset view" title="Reset view">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button type="button" className={btn} onClick={copyPng} aria-label="Copy as PNG" title="Copy as PNG">
            {copied === "png" ? (
              <Check className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
            ) : (
              <ImageDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
          <button type="button" className={btn} onClick={copySvg} aria-label="Copy SVG markup" title="Copy SVG markup">
            {copied === "svg" ? (
              <Check className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
            ) : (
              <Code2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative h-full max-h-[70vh] min-h-[8rem] cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        <div
          ref={contentRef}
          className="origin-top-left p-4 [&_svg]:max-w-none"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
