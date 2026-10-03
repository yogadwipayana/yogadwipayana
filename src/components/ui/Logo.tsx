import { cn } from "@/lib/utils";

/**
 * A geometric Y in the site's emerald palette, sized via `className`.
 * Two solid planes and softened terminals stay crisp at navigation sizes.
 */
type LogoProps = {
  className?: string;
  width?: number;
  height?: number;
};

export function Logo({ className, width, height }: LogoProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={width}
      height={height}
      fill="none"
      role="img"
      aria-label="Yoga logo"
      focusable="false"
      className={cn(
        "shrink-0",
        width === undefined && height === undefined && "h-5 w-5",
        className,
      )}
    >
      <path
        d="M3.75 3H10.6C10.86 3 11.11 3.14 11.25 3.36L17.4 13.1L12 18.4L3.12 4.16C2.8 3.66 3.16 3 3.75 3Z"
        fill="#24b47e"
      />
      <path
        d="M21.4 3H28.25C28.84 3 29.2 3.66 28.88 4.16L19.5 18.4V28.25C19.5 28.66 19.16 29 18.75 29H12.75C12.34 29 12 28.66 12 28.25V18.4L20.75 3.36C20.89 3.14 21.14 3 21.4 3Z"
        fill="#3ecf8e"
      />
    </svg>
  );
}
