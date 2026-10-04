import { aiDb } from "@/lib/db/ai";

export type AiCreditStatus = "active" | "inactive" | "not-configured";

/** An owner's AI Router credit, in USD. */
export interface AiCredit {
  status: AiCreditStatus;
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
}

/**
 * Read an owner's AI Router credit.
 *
 * Spend comes from the pre-aggregated `ownerSpend` table — one row per owner,
 * maintained upstream. Verified to match SUM(usageHistory.cost) exactly, at a
 * fraction of the cost of scanning the full history.
 */
export async function getAiCredit(email: string): Promise<AiCredit> {
  const [owner, spend] = await Promise.all([
    aiDb.ownerUsers.findUnique({ where: { email } }),
    aiDb.ownerSpend.findUnique({ where: { owner: email } }),
  ]);

  const budgetUsd = owner?.budgetUsd ?? 0;
  const spentUsd = spend?.spentUsd ?? 0;

  return {
    status: !owner ? "not-configured" : owner.isActive === 1 ? "active" : "inactive",
    budgetUsd,
    spentUsd,
    remainingUsd: Math.max(0, budgetUsd - spentUsd),
  };
}
