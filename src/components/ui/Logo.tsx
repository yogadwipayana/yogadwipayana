import { cn } from "@/lib/utils";

/**
 * The "y" brand mark — a geometric lowercase y: a left arm meeting a right
 * arm that continues into the descender. Sized via `className` (e.g. "h-4 w-4").
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="Yoga logo"
      className={cn("h-4 w-4", className)}
    >
      <path
        d="M6.5 6 L12 13"
        stroke="#3ecf8e"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 6 L8.8 17.2"
        stroke="#3ecf8e"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
