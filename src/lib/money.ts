/**
 * Currency formatting shared by the wallet and every tool that spends from it.
 * Isomorphic — safe to import from server components and the browser alike.
 */

/** "Rp5.000" — Indonesian grouping, no decimals. */
export function formatIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}
