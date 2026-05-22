import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF guard: like `fetch` but rejects requests to non-public destinations.
 *
 * Blocks:
 *   - non-http(s) protocols
 *   - hostnames that resolve to RFC1918 / link-local / loopback / IMDS / CGNAT
 *   - cross-protocol redirects (manual redirect, re-validating after each hop)
 *
 * Also enforces an absolute deadline so a malicious server can't keep the
 * connection open indefinitely. Caller is responsible for body-size caps.
 */

export type SafeFetchOptions = RequestInit & {
  /** Hard timeout in ms (default 10 000, max 30 000). */
  timeoutMs?: number;
  /** Max redirect hops (default 3). */
  maxRedirects?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const HARD_TIMEOUT_CEIL = 30_000;
const DEFAULT_MAX_REDIRECTS = 3;

export class SsrfError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SsrfError";
  }
}

function isBlockedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map((n) => Number(n));
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local + IMDS
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (family === 6) {
    const lc = ip.toLowerCase();
    if (lc === "::" || lc === "::1") return true;
    if (lc.startsWith("fe80:")) return true; // link-local
    if (lc.startsWith("fc") || lc.startsWith("fd")) return true; // unique-local
    if (lc.startsWith("ff")) return true; // multicast
    if (lc.startsWith("::ffff:")) {
      // IPv4-mapped — strip and re-check the v4 portion.
      const v4 = lc.replace("::ffff:", "");
      if (isIP(v4) === 4) return isBlockedIp(v4);
    }
    return false;
  }
  // Hostname that we couldn't classify; treat as blocked.
  return true;
}

async function assertHostnameIsPublic(hostname: string): Promise<void> {
  // If the user gave us a literal IP, evaluate it directly.
  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new SsrfError("BLOCKED_IP", `Refusing to fetch ${hostname}`);
    }
    return;
  }

  const records = await lookup(hostname, { all: true }).catch(() => null);
  if (!records || records.length === 0) {
    throw new SsrfError("DNS_FAIL", `Could not resolve ${hostname}`);
  }
  for (const r of records) {
    if (isBlockedIp(r.address)) {
      throw new SsrfError(
        "BLOCKED_IP",
        `Refusing to fetch ${hostname} (resolves to ${r.address})`,
      );
    }
  }
}

function assertHttpUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("BAD_SCHEME", `Only http(s) URLs are allowed`);
  }
}

/**
 * Pre-validate that a URL is a public http(s) destination, without performing
 * the actual fetch. Useful when handing the URL to a third-party service that
 * will fetch it on our behalf (e.g. an image model), and we still want to
 * refuse internal addresses.
 */
export async function validatePublicHttpUrl(
  rawUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Only http(s) URLs are allowed" };
  }
  try {
    await assertHostnameIsPublic(parsed.hostname);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof SsrfError ? err.message : "URL not allowed",
    };
  }
}

/**
 * Fetch a URL while enforcing SSRF protections. Manual redirect handling lets
 * us re-resolve the host on every hop.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const timeoutMs = Math.min(
    HARD_TIMEOUT_CEIL,
    Math.max(1_000, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  );
  const maxRedirects = Math.max(0, options.maxRedirects ?? DEFAULT_MAX_REDIRECTS);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  try {
    let current: URL;
    try {
      current = new URL(rawUrl);
    } catch {
      throw new SsrfError("BAD_URL", "Invalid URL");
    }

    for (let hop = 0; hop <= maxRedirects; hop++) {
      assertHttpUrl(current);
      await assertHostnameIsPublic(current.hostname);

      const response = await fetch(current.toString(), {
        ...options,
        redirect: "manual",
        signal: controller.signal,
      });

      const status = response.status;
      const isRedirect = status >= 300 && status < 400 && response.headers.get("location");
      if (!isRedirect) return response;
      if (hop === maxRedirects) {
        throw new SsrfError("TOO_MANY_REDIRECTS", "Too many redirects");
      }

      const location = response.headers.get("location") ?? "";
      const next = new URL(location, current);
      // Drain the body before the next hop so the socket is freed.
      try {
        await response.body?.cancel();
      } catch {
        // Ignored.
      }
      current = next;
    }

    throw new SsrfError("UNREACHABLE", "Redirect loop");
  } finally {
    clearTimeout(timer);
  }
}
