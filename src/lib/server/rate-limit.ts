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
};

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
