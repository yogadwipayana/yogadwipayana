import Link from "next/link";

/**
 * Previous/next pager for the dashboard's server-rendered lists.
 *
 * Deliberately not a client component: paging is a navigation, so the links are
 * real hrefs that work without JavaScript and keep the page shareable. `hrefFor`
 * is a plain function because the callers are server components too — it lets
 * each page preserve its own query string (filters, ranges) around the page
 * number instead of this component guessing at them.
 *
 * Renders nothing for a single page, so callers can mount it unconditionally.
 */
export function Pagination({
  page,
  totalPages,
  pageSize,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  hrefFor: (target: number) => string;
}) {
  if (totalPages <= 1) return null;

  const atStart = page <= 1;
  const atEnd = page >= totalPages;
  const edge =
    "rounded-md border border-white/[0.08] px-3 py-1.5 transition-colors hover:bg-white/[0.04] hover:text-white/70";
  const spent = "pointer-events-none opacity-30";

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-[12px] text-white/40">
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={atStart}
        // Removed from the tab order rather than just dimmed: a disabled-looking
        // link that still takes focus and navigates is worse than no link.
        tabIndex={atStart ? -1 : undefined}
        className={`${edge} ${atStart ? spent : ""}`}
      >
        Previous
      </Link>
      <span className="text-center">
        Page {page} of {totalPages}
        <span className="hidden sm:inline"> · {pageSize} per page</span>
      </span>
      <Link
        href={hrefFor(page + 1)}
        aria-disabled={atEnd}
        tabIndex={atEnd ? -1 : undefined}
        className={`${edge} ${atEnd ? spent : ""}`}
      >
        Next
      </Link>
    </div>
  );
}
