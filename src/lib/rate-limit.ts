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
