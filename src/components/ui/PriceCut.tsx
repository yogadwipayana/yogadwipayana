/** Small "-70%" pill marking a promotional price. */
export function DiscountBadge({ percent }: { percent: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-1 font-sans text-[10px] font-medium leading-4 text-[#3ecf8e]">
      -{percent}%
    </span>
  );
}

/** The regular price a discount replaces, struck through. */
export function RegularPrice({ children }: { children: string }) {
  return (
    <s className="text-white/30">
      <span className="sr-only">Regular price </span>
      {children}
    </s>
  );
}

/**
 * Promo line shown under a discounted price: the cut and the regular price it
 * replaces. Alignment follows the parent via `className` (e.g. `justify-end`).
 */
export function PriceCut({
  percent,
  regular,
  className = "",
}: {
  percent: number;
  regular: string;
  className?: string;
}) {
  return (
    <span
      className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] ${className}`}
    >
      <DiscountBadge percent={percent} />
      <RegularPrice>{regular}</RegularPrice>
    </span>
  );
}
