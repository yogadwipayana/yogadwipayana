/**
 * Currency formatting shared by the wallet and every tool that spends from it.
 * Isomorphic — safe to import from server components and the browser alike.
 */

/** "Rp5.000" — Indonesian grouping, no decimals. */
export function formatIdr(value: number): string {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

/** "$1.50" — four decimals for sub-cent amounts so they don't read as $0.00. */
export function formatUsd(value: number): string {
  const decimals = value > 0 && value <= 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
