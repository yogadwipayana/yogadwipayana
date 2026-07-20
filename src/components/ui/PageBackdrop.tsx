"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/** Maximum drift, in px, when the cursor reaches a viewport edge. */
const MAX_SHIFT = 24;

/**
 * Page-wide ambient backdrop. Fixed to the viewport so it follows the
 * user down the page, with a slow parallax drift that trails the mouse.
 * Decorative only: the drift is skipped for reduced-motion users and
 * touch devices, where the layer simply stays fixed while scrolling.
 */
export function PageBackdrop() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;

    const tick = () => {
      x += (targetX - x) * 0.05;
      y += (targetY - y) * 0.05;
      layer.current?.style.setProperty(
        "transform",
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`,
      );
      if (Math.abs(targetX - x) > 0.1 || Math.abs(targetY - y) > 0.1) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const onMove = (e: MouseEvent) => {
      // Drift opposite the cursor for a depth feel, eased by tick().
      targetX = -(e.clientX / window.innerWidth - 0.5) * 2 * MAX_SHIFT;
      targetY = -(e.clientY / window.innerHeight - 0.5) * 2 * MAX_SHIFT;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      {/* Oversized so the drift never reveals an edge. */}
      <div ref={layer} className="absolute -inset-10 will-change-transform">
        <Image
          src="/images/hero/ambient.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-60"
        />
      </div>
    </div>
  );
}
