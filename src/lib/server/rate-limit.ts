import { ApiError } from "./api-response";

// ─────────────────────────────────────────────────────────────────────────────
// In-process sliding-window rate limiter.
//
// The origin uses Upstash Redis so it works across many serverless workers.
// We don't have Redis here, so this is a single-process fallback intended for
// single-instance EC2 deployment. If/when the app moves behind a load
// balancer with multiple instances, swap this out for Upstash or pg-based
// counters.
// ─────────────────────────────────────────────────────────────────────────────

type WindowUnit = "s" | "m" | "h" | "d";
const UNIT_MS: Record<WindowUnit, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export interface Ratelimit {
  limit: number;
  windowMs: number;
  prefix: string;
}

function parseWindow(window: `${number}${WindowUnit}`): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid rate-limit window: ${window}`);
  return Number(match[1]) * UNIT_MS[match[2] as WindowUnit];
}

function createRatelimit(
  prefix: string,
  limit: number,
  window: `${number}${WindowUnit}`,
): Ratelimit {
  return { limit, windowMs: parseWindow(window), prefix };
}

export const ratelimits = {
  connectCloud: createRatelimit("ratelimit:connect-cloud", 20, "1m"),
  credentials: createRatelimit("ratelimit:credentials", 10, "1m"),
  chat: createRatelimit("ratelimit:chat", 30, "1m"),
  ai: createRatelimit("ratelimit:ai", 30, "1m"),
  imageGen: createRatelimit("ratelimit:image-gen", 10, "1h"),
  imageGenDaily: createRatelimit("ratelimit:image-gen-daily", 60, "1d"),
  imageEnhance: createRatelimit("ratelimit:image-enhance", 30, "1h"),
  contact: createRatelimit("ratelimit:contact", 5, "1h"),
  console: createRatelimit("ratelimit:console", 30, "1m"),
  upload: createRatelimit("ratelimit:upload", 60, "1m"),
  vpsAction: createRatelimit("ratelimit:vps-action", 30, "1m"),
  // Each order spends real SMSPool credit, so this is deliberately tight.
  smsOrder: createRatelimit("ratelimit:sms-order", 5, "1m"),
  smsPoll: createRatelimit("ratelimit:sms-poll", 90, "1m"),
  // Voucher codes are guessable in principle, so redemption is throttled harder
  // than a normal write.
  balanceVoucher: createRatelimit("ratelimit:balance-voucher", 10, "1m"),
};

/** Best-effort client IP extractor for use as a rate-limit identifier. */
export function getClientIp(headers: Headers): string | undefined {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || undefined;
  return headers.get("x-real-ip") ?? undefined;
}

const hits = new Map<string, number[]>();

export async function checkRateLimit(
  ratelimit: Ratelimit | null,
  identifier: string,
  context?: string,
): Promise<void> {
  if (!ratelimit) return;

  const now = Date.now();
  const cutoff = now - ratelimit.windowMs;
  const key = `${ratelimit.prefix}:${identifier}`;

  const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (arr.length >= ratelimit.limit) {
    const reset = arr[0] + ratelimit.windowMs;
    const retryAfter = Math.max(1, Math.ceil((reset - now) / 1000));
    throw new ApiError(
      429,
      "RATE_LIMIT_EXCEEDED",
      `Rate limit exceeded${context ? ` for ${context}` : ""}. Retry after ${retryAfter}s`,
      { limit: ratelimit.limit, remaining: 0, retryAfter },
    );
  }
  arr.push(now);
  hits.set(key, arr);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      const fresh = v.filter((t) => t > cutoff);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
  }
}

export function getRateLimitIdentifier(userId: string, ip?: string): string {
  return ip ? `${userId}:${ip}` : userId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Result-returning fixed-window limiter.
//
// `checkRateLimit` above throws an ApiError (429), which suits route handlers.
// Server actions instead return a structured ActionResult, so they need a
// limiter that REPORTS the outcome rather than throwing — that's the API below.
// Same single-process caveat applies: swap for Upstash/pg counters when the app
// runs multiple instances. (Consolidated here from the former @/lib/rate-limit.)
// ─────────────────────────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export type RateLimitOptions = {
  /** Logical scope, e.g. "sign-in". */
  key: string;
  /** Identifier within the scope, e.g. ip + email. */
  identifier: string;
  /** Max attempts allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export function rateLimit({
  key,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions): RateLimitResult {
  const id = `${key}::${identifier}`;
  const now = Date.now();
  const bucket = buckets.get(id);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
}

export function rateLimitReset(key: string, identifier: string) {
  buckets.delete(`${key}::${identifier}`);
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let sweepTimer: ReturnType<typeof setInterval> | null = null;
if (typeof setInterval !== "undefined" && !sweepTimer) {
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(id);
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweepTimer === "object" && sweepTimer && "unref" in sweepTimer) {
    (sweepTimer as { unref?: () => void }).unref?.();
  }
}
