/**
 * SMSPool API client — the disposable-number provider behind the SMS OTP tool.
 *
 * Reference: https://api.smspool.net/resources/postman.json
 *
 * Every endpoint is POST with `application/x-www-form-urlencoded` and carries
 * the API key in a `key` field (the collection also advertises bearer auth; the
 * form field is what the endpoints actually read). Errors come back in two
 * shapes, so `request()` normalizes both into an ApiError:
 *
 *   { "success": 0, "errors": [{ "message": "…", "param": "key" }] }   400/403
 *   { "success": 0, "message": "…", "type": "OUT_OF_STOCK" }           422
 */

import { ApiError } from "./api-response";

const BASE_URL = "https://api.smspool.net";
const TIMEOUT_MS = 15_000;

/** SMSPool's service ID for "OpenAI / ChatGPT" — the one Codex verifies against. */
export const OPENAI_SERVICE_ID = 671;
export const OPENAI_SERVICE_NAME = "OpenAI / ChatGPT";

/** Country the tool orders from, as an ISO code or SMSPool country ID. */
export function smspoolCountry(): string {
  return process.env.SMSPOOL_COUNTRY?.trim() || "US";
}

/**
 * Optional ceiling (in USD) on what a single number may cost. Without it a
 * price spike at the provider would be charged silently.
 */
export function smspoolMaxPrice(): number | null {
  const raw = process.env.SMSPOOL_MAX_PRICE?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function apiKey(): string {
  const key = process.env.SMSPOOL_API_KEY?.trim();
  if (!key) {
    throw new ApiError(
      503,
      "SMSPOOL_NOT_CONFIGURED",
      "SMS provider is not configured. Set SMSPOOL_API_KEY.",
    );
  }
  return key;
}

/* -------------------------------------------------------------------------- */
/*  Transport                                                                  */
/* -------------------------------------------------------------------------- */

type Params = Record<string, string | number | undefined>;

/** Pull a human-readable message out of either SMSPool error envelope. */
function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const record = body as Record<string, unknown>;

  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as Record<string, unknown> | undefined;
    if (first && typeof first.message === "string") return stripHtml(first.message);
  }
  if (typeof record.message === "string" && record.message) {
    return stripHtml(record.message);
  }
  return fallback;
}

/** Some SMSPool messages arrive as HTML fragments; render them as plain text. */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Provider prose routinely quotes the OPERATOR's money — "the price is: 0.24
 * while you only have: 0.00" when our account runs dry, "you have been refunded
 * 0.14 dollars" on a cancel. Those are wholesale figures and our own balance;
 * a buyer paying a flat rupiah price has no business seeing either.
 *
 * The wording varies per pool and per endpoint, so this rejects anything
 * money-shaped instead of trying to enumerate the phrasings — a message we
 * haven't seen yet is exactly the one that would leak. Order-scoped messages
 * carrying no figures ("your order cannot be cancelled yet") pass through and
 * stay useful. The original is logged, so nothing is lost for debugging.
 */
const MONEY_SHAPED = /\$|\bdollars?\b|\bbalance\b|\bcredits?\b|\d+\.\d{2}\b/i;

function safeMessage(raw: string, fallback: string): string {
  if (!MONEY_SHAPED.test(raw)) return raw;
  console.error("[smspool] withheld provider message:", raw);
  return fallback;
}

async function request<T>(path: string, params: Params = {}): Promise<T> {
  const body = new URLSearchParams();
  body.set("key", apiKey());
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") body.set(name, String(value));
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new ApiError(
      504,
      "SMSPOOL_UNREACHABLE",
      timedOut
        ? "SMS provider did not respond in time."
        : "Could not reach the SMS provider.",
    );
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError(
      502,
      "SMSPOOL_BAD_RESPONSE",
      "SMS provider returned an unreadable response.",
    );
  }

  if (!res.ok) {
    // 401/403 mean *our* key is bad — that's a server misconfiguration, not a
    // client error, so it must not be reflected back as an auth failure.
    const status = res.status === 401 || res.status === 403 ? 503 : res.status;
    const code =
      res.status === 401 || res.status === 403
        ? "SMSPOOL_AUTH_FAILED"
        : typeof (parsed as Record<string, unknown>)?.type === "string"
          ? String((parsed as Record<string, unknown>).type)
          : "SMSPOOL_ERROR";
    const fallback = "The SMS provider rejected the request.";
    throw new ApiError(
      status,
      code,
      safeMessage(errorMessage(parsed, fallback), fallback),
    );
  }

  return parsed as T;
}

/* -------------------------------------------------------------------------- */
/*  Endpoints                                                                  */
/* -------------------------------------------------------------------------- */

export type SmspoolBalance = { balance: string };

/** POST /request/balance — remaining credit on the app's SMSPool account. */
export async function getBalance(): Promise<number> {
  const data = await request<SmspoolBalance>("/request/balance");
  const value = Number(data.balance);
  return Number.isFinite(value) ? value : 0;
}

export type SmspoolPrice = {
  pool: number;
  price: string;
  high_price: string;
  success_rate: number;
};

/** POST /request/price — current price and success rate for country + service. */
export async function getPrice(
  country: string,
  service: number,
): Promise<{ price: number; successRate: number }> {
  const data = await request<SmspoolPrice>("/request/price", { country, service });
  const price = Number(data.price);
  return {
    price: Number.isFinite(price) ? price : 0,
    successRate: Number(data.success_rate) || 0,
  };
}

export type SmspoolStock = { success: number; amount?: number };

/** POST /sms/stock — how many one-time numbers are available right now. */
export async function getStock(country: string, service: number): Promise<number> {
  const data = await request<SmspoolStock>("/sms/stock", { country, service });
  return Number(data.amount) || 0;
}

export type SmspoolOrder = {
  success: number;
  order_id: string;
  /** Full number including country code, e.g. 12345678901. */
  number: number | string;
  cc: string;
  phonenumber: string;
  country: string;
  service: string;
  pool: number | string;
  /** Seconds until the number stops accepting messages. */
  expires_in: number;
  /** Unix seconds. */
  expiration: number;
  cost: string;
  message?: string;
};

/**
 * POST /purchase/sms — rent one number.
 *
 * `pricing_option: 1` asks SMSPool for the highest success rate rather than the
 * cheapest number; for OTP delivery a failed number costs more than the spread.
 */
export async function orderSms(opts: {
  country: string;
  service: number;
  maxPrice?: number | null;
}): Promise<SmspoolOrder> {
  const data = await request<SmspoolOrder>("/purchase/sms", {
    country: opts.country,
    service: opts.service,
    quantity: 1,
    pricing_option: 1,
    activation_type: "SMS",
    max_price: opts.maxPrice ?? undefined,
  });

  // A 200 with success: 0 is possible (e.g. partial pool failures), so the
  // envelope is checked even on a non-error status.
  if (Number(data.success) !== 1 || !data.order_id) {
    // This is the BALANCE_ERROR path when our own SMSPool credit runs out, and
    // its message quotes both the wholesale price and our remaining balance.
    const fallback = "Could not get a number right now. Try again shortly.";
    throw new ApiError(
      422,
      "SMSPOOL_ORDER_FAILED",
      safeMessage(errorMessage(data, fallback), fallback),
    );
  }
  return data;
}

/** Normalized order state — see the sms_order migration for the mapping. */
export type SmsCheckStatus = "pending" | "cancelled" | "completed" | "refunded";

export type SmspoolCheck = {
  status: SmsCheckStatus;
  code: string | null;
  fullSms: string | null;
  /** Unix seconds, when SMSPool reports it. */
  expiration: number | null;
  timeLeft: number | null;
  resendAvailable: boolean;
};

type SmspoolCheckRaw = {
  status: number;
  sms?: string;
  full_sms?: string;
  expiration?: number;
  time_left?: number;
  resend?: number;
  message?: string;
};

/**
 * Numeric statuses SMSPool documents. Anything unlisted is treated as pending
 * so an unknown code never strands an order in a terminal state.
 */
const STATUS_BY_CODE: Record<number, SmsCheckStatus> = {
  1: "pending",
  2: "cancelled",
  3: "completed",
  6: "refunded",
};

/**
 * POST /sms/check — state of a single order.
 *
 * SMSPool rate-limits this endpoint and recommends /request/active for polling
 * many orders at once; callers polling a list should use `listActive()`.
 */
export async function checkSms(orderId: string): Promise<SmspoolCheck> {
  const data = await request<SmspoolCheckRaw>("/sms/check", { orderid: orderId });
  return {
    status: STATUS_BY_CODE[Number(data.status)] ?? "pending",
    code: data.sms || null,
    fullSms: data.full_sms || null,
    expiration: Number(data.expiration) || null,
    timeLeft: typeof data.time_left === "number" ? data.time_left : null,
    resendAvailable: Number(data.resend) === 1,
  };
}

export type SmspoolActiveOrder = {
  order_code: string;
  phonenumber: string;
  /** "0" while no SMS has arrived. */
  code: string;
  full_code: string;
  short_name: string;
  service: string;
  status: string;
  cost: string;
  expiry: number;
  time_left: number;
};

/**
 * POST /request/active — every open order on the account in one call. This is
 * SMSPool's recommended polling endpoint; it avoids the /sms/check rate limit.
 *
 * The account is app-wide, so results span all users — callers must intersect
 * against the order ids they own.
 */
export async function listActive(): Promise<SmspoolActiveOrder[]> {
  const data = await request<SmspoolActiveOrder[] | Record<string, unknown>>(
    "/request/active",
  );
  return Array.isArray(data) ? data : [];
}

export type SmspoolSimpleResult = { success: number; message?: string };

/**
 * POST /sms/cancel — release a number early and refund it. SMSPool refuses to
 * cancel within the first minutes of an order, which surfaces as a 400.
 */
export async function cancelSms(orderId: string): Promise<string> {
  const data = await request<SmspoolSimpleResult>("/sms/cancel", {
    orderid: orderId,
  });
  if (Number(data.success) !== 1) {
    const fallback = "This order cannot be cancelled yet.";
    throw new ApiError(
      400,
      "SMSPOOL_CANCEL_FAILED",
      safeMessage(errorMessage(data, fallback), fallback),
    );
  }
  // The success message reads "you have been refunded 0.14 dollars" — our
  // wholesale refund, not the buyer's. Callers word their own; this is a
  // last-resort guard for any that forget.
  return safeMessage(
    stripHtml(data.message ?? "Order cancelled."),
    "Order cancelled.",
  );
}

export type SmspoolResendInfo = {
  available: boolean;
  /** Resends still allowed on this number. */
  resendsLeft: number | null;
  /** Charge per resend; 0 for most pools. */
  cost: number | null;
  /** Hours the number stays resendable — up to ~120. */
  expiresInHours: number | null;
  message: string | null;
};

type SmspoolResendInfoRaw = {
  success: number;
  message?: string;
  resends?: number;
  resendCost?: number;
  expires_in_hour?: number;
};

/**
 * POST /sms/check_resend — whether the number can still be re-requested, how
 * many times, at what price, and for how long.
 *
 * This is the *long* clock. A number's first-SMS window is ~20 minutes
 * (`expires_in` from /purchase/sms), but it stays resendable for up to ~120
 * hours, so an order that missed its first SMS is not necessarily dead.
 *
 * "Not available" is a normal answer here, not a failure, so a 400/404 from the
 * provider resolves to `available: false` rather than throwing.
 */
export async function checkResend(orderId: string): Promise<SmspoolResendInfo> {
  let data: SmspoolResendInfoRaw;
  try {
    data = await request<SmspoolResendInfoRaw>("/sms/check_resend", {
      orderid: orderId,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
      return {
        available: false,
        resendsLeft: null,
        cost: null,
        expiresInHours: null,
        message: err.message,
      };
    }
    throw err;
  }

  const available = Number(data.success) === 1;
  return {
    available,
    resendsLeft: typeof data.resends === "number" ? data.resends : null,
    cost: typeof data.resendCost === "number" ? data.resendCost : null,
    expiresInHours:
      typeof data.expires_in_hour === "number" ? data.expires_in_hour : null,
    message: data.message
      ? safeMessage(stripHtml(data.message), "Resend availability checked.")
      : null,
  };
}

/**
 * POST /sms/resend — ask the number to be re-requested. Only works once an
 * initial SMS has arrived, and some pools charge for it.
 */
export async function resendSms(orderId: string): Promise<string> {
  const data = await request<SmspoolSimpleResult>("/sms/resend", {
    orderid: orderId,
  });
  if (Number(data.success) !== 1) {
    const fallback = "This number is not available for resend.";
    throw new ApiError(
      400,
      "SMSPOOL_RESEND_FAILED",
      safeMessage(errorMessage(data, fallback), fallback),
    );
  }
  // Pools that charge for a resend say so here, in dollars.
  const fallback = "Number requested again.";
  return safeMessage(stripHtml(data.message ?? fallback), fallback);
}
