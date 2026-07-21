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

/* -------------------------------------------------------------------------- */
/*  SMS vouchers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * An SMS voucher as the router reports it. `amountIdr` is the rupiah value to
 * credit; the AI-side `amountUsd` is always 0 for this kind.
 */
export type ClaimedSmsVoucher = {
  code: string;
  amountIdr: number;
};

export class VoucherClaimError extends Error {
  /** True when the router blamed the request (unknown/used code), not itself. */
  clientFault: boolean;

  constructor(message: string, clientFault: boolean) {
    super(message);
    this.clientFault = clientFault;
  }
}

async function voucherClaimRequest(
  method: "POST" | "DELETE",
  code: string,
  email: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(aiUrl("/admin/voucher/claim"), {
      method,
      headers: aiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ code, email }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Spend an SMS voucher code upstream and get its rupiah value back.
 *
 * The router only marks the code used — it holds no rupiah wallet. The caller
 * must credit its own ledger next, and call `releaseSmsVoucher` if that fails,
 * or the buyer loses the code without getting the balance.
 */
export async function claimSmsVoucher(
  code: string,
  email: string,
): Promise<ClaimedSmsVoucher> {
  if (!aiAdminConfigured()) {
    throw new VoucherClaimError("Voucher service is not configured.", false);
  }

  let result: Awaited<ReturnType<typeof voucherClaimRequest>>;
  try {
    result = await voucherClaimRequest("POST", code, email);
  } catch (err) {
    console.error("[voucher] claim request failed", err);
    throw new VoucherClaimError("Voucher service is unreachable.", false);
  }

  const body = result.body as { voucher?: ClaimedSmsVoucher; error?: string } | null;
  if (!result.ok) {
    const clientFault = result.status >= 400 && result.status < 500;
    console.error("[voucher] claim rejected", result.status, body?.error);
    throw new VoucherClaimError(
      clientFault ? body?.error ?? "Invalid voucher code." : "Voucher service error.",
      clientFault,
    );
  }

  const amountIdr = Math.round(Number(body?.voucher?.amountIdr ?? 0));
  if (!Number.isFinite(amountIdr) || amountIdr <= 0) {
    // A zero-value SMS voucher means the code was created for the wrong product.
    // Hand it straight back so it isn't burned for nothing.
    await releaseSmsVoucher(code, email);
    throw new VoucherClaimError("This voucher carries no balance.", true);
  }

  return { code: body?.voucher?.code ?? code, amountIdr };
}

/**
 * Undo a claim. Best-effort by design: it runs on a path that is already
 * failing, so it reports rather than throws — the caller's own error is the one
 * the user needs to see.
 */
export async function releaseSmsVoucher(
  code: string,
  email: string,
): Promise<boolean> {
  if (!aiAdminConfigured()) return false;
  try {
    const result = await voucherClaimRequest("DELETE", code, email);
    if (!result.ok) {
      console.error("[voucher] release rejected", result.status, code);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[voucher] release failed", code, err);
    return false;
  }
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
