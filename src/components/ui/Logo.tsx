import { cn } from "@/lib/utils";

/**
 * The Yoga brand mark — an isometric cube (a builder/infrastructure motif).
 * Three rhombus faces share a center vertex; the top face is brightest and the
 * two side faces step down in opacity to read as 3D. Sized via `className`.
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
      {/* top face */}
      <path
        d="M12 3 L20 7.5 L12 12 L4 7.5 Z"
        fill="#3ecf8e"
      />
      {/* left face */}
      <path
        d="M4 7.5 L12 12 L12 21 L4 16.5 Z"
        fill="#3ecf8e"
        fillOpacity={0.5}
      />
      {/* right face */}
      <path
        d="M20 7.5 L12 12 L12 21 L20 16.5 Z"
        fill="#3ecf8e"
        fillOpacity={0.75}
      />
    </svg>
  );
}
