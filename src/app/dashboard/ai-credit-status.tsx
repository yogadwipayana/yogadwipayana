import type { AiCreditStatus } from "@/lib/server/ai-credit";

const STATUS_STYLES: Record<AiCreditStatus | "signed-out", { label: string; className: string }> = {
  active: { label: "Active", className: "text-[#3ecf8e]" },
  inactive: { label: "Inactive", className: "text-yellow-400" },
  "not-configured": { label: "Not configured", className: "text-white/40" },
  "signed-out": { label: "Sign in", className: "text-white/40" },
};

/** Account status shown next to the AI credit balance. `null` means signed out. */
export function AiCreditStatusBadge({ status }: { status: AiCreditStatus | null }) {
  const { label, className } = STATUS_STYLES[status ?? "signed-out"];
  return (
    <span className={`text-[10px] uppercase tracking-[0.1em] ${className}`}>{label}</span>
  );
}
