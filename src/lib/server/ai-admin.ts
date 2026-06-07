import { aiDb } from "@/lib/db/ai";

/** Default spend budget assigned to a freshly provisioned AI-router owner. */
export const DEFAULT_OWNER_BUDGET_USD = 0;

const UPSTREAM_TIMEOUT_MS = 25_000;

export function aiAdminConfigured(): boolean {
  return Boolean(process.env.AI_BASE_URL && process.env.ADMIN_AI_API_KEY);
}

export function aiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.ADMIN_AI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export function aiUrl(path: string): string {
  const base = (process.env.AI_BASE_URL ?? "").replace(/\/v1\/?$/, "");
  return `${base}/v1${path}`;
}

/**
 * Ensure an AI-router owner record exists for `email`. No-op when the owner is
 * already present (checked against the read-only AI DB, where `email` is the
 * PK, to avoid an upstream round-trip). The owner is created over HTTP because
 * `aiDb` is read-only and cannot write to `ownerUsers`.
 *
 * Throws on missing config or a non-2xx upstream response — callers decide
 * whether that should be fatal (key creation) or best-effort (registration).
 */
export async function ensureAiOwner(email: string): Promise<void> {
  if (!aiAdminConfigured()) {
    throw new Error("AI router not configured");
  }

  const existing = await aiDb.ownerUsers
    .findUnique({ where: { email }, select: { email: true } })
    .catch(() => null);
  if (existing) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(aiUrl("/admin/users"), {
      method: "POST",
      headers: aiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        email,
        budgetUsd: DEFAULT_OWNER_BUDGET_USD,
        isActive: true,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI owner create failed: ${res.status} ${detail}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
