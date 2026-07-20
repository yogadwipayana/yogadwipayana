"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const IMAGES = [
  "/images/hero/aurora.png",
  "/images/hero/mesh.png",
  "/images/hero/waves.png",
  "/images/hero/orbs.png",
];

const ROTATE_MS = 4000;

/**
 * Slowly crossfading background image rotation for the hero. Purely
 * decorative: stays on the first frame when the user prefers reduced
 * motion, and pauses while the tab is hidden.
 */
export function HeroBackdrop() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let id: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      id ??= setInterval(
        () => setIndex((i) => (i + 1) % IMAGES.length),
        ROTATE_MS,
      );
    };
    const stop = () => {
      if (id !== undefined) clearInterval(id);
      id = undefined;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    // The mask fades the whole stack (frames + veil) to transparent at the
    // bottom, so the hero melts into the page-wide backdrop with no seam.
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_55%,transparent_100%)]"
    >
      {IMAGES.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-[1500ms] ease-in-out ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      {/* Veil so the headline and stats stay readable over any frame. */}
      <div className="absolute inset-0 bg-[#171717]/45" />
    </div>
  );
}
