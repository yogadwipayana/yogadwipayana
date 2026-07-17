"use client";

import { useEffect, useState } from "react";

type TypedTextProps = {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  /** Delay in ms before typing starts. */
  startDelay?: number;
};

/**
 * Types out `text` one character at a time, like a streaming model reply.
 * Renders the full text immediately when reduced motion is preferred.
 */
export function TypedText({
  text,
  speed = 18,
  startDelay = 900,
}: TypedTextProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }

    let shown = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        shown += 1;
        setCount(shown);
        if (shown >= text.length) clearInterval(interval);
      }, speed);
    }, startDelay);

    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return <>{text.slice(0, count)}</>;
}
