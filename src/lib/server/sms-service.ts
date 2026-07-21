/**
 * SMS OTP service — owns the sms_order table and the SMSPool orchestration
 * behind it.
 *
 * Division of responsibility: SMSPool is authoritative for a live order, the
 * table is authoritative for *ownership* (one app-wide API key means SMSPool
 * cannot tell users apart) and for history once SMSPool drops the order.
 * `refreshOrders` reconciles the two.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { formatIdr } from "../money";
import { SMS_PRICE_IDR } from "../sms-order";
import { ApiError } from "./api-response";
import { creditBalance, debitBalance } from "./balance-service";
import {
  OPENAI_SERVICE_ID,
  OPENAI_SERVICE_NAME,
  cancelSms,
  checkResend,
  checkSms,
  // Aliased: `getBalance` here means the buyer's wallet, not the operator's
  // SMSPool credit, and mixing the two up would leak the latter into the UI.
  getBalance as getProviderBalance,
  getPrice,
  getStock,
  listActive,
  orderSms,
  resendSms,
  smspoolCountry,
  smspoolMaxPrice,
} from "./smspool";

export type SmsOrderStatus =
  | "pending"
  | "cancelled"
  | "completed"
  | "refunded"
  | "expired";

export type SmsOrderRow = {
  id: string;
  user_id: string;
  order_id: string;
  phone_number: string;
  country: string;
  service: string;
  service_id: number;
  pool: string | null;
  status: SmsOrderStatus;
  /** Most recent code delivered to this number. */
  code: string | null;
  full_sms: string | null;
  /** End of the ~20-minute window for the FIRST SMS. */
  expires_at: string | null;
  /** End of the ~120-hour window in which the number can be re-requested. */
  resend_expires_at: string | null;
  resends_left: number | null;
  /** Ledger reference for the debit that paid for the request in flight. */
  charge_ref: string | null;
  /** Retail price of that request, in rupiah. Null for pre-wallet orders. */
  charged_idr: number | null;
  /** True once the current charge has produced an SMS — see the migration. */
  charge_delivered: boolean;
  created_at: string;
  updated_at: string;
  /** Every SMS this number has received, oldest first. */
  messages: SmsMessageRow[];
};

export type SmsMessageRow = {
  id: string;
  code: string | null;
  full_sms: string | null;
  received_at: string;
};

/**
 * `cost` and `resend_cost` are deliberately absent: they hold SMSPool's
 * wholesale prices, which are written on insert for accounting but must never
 * reach the browser. Not selecting them is what enforces that — omitting them
 * from the UI alone would still leave them readable in the API response.
 */
const ORDER_COLS =
  "id,user_id,order_id,phone_number,country,service,service_id,pool,status,code,full_sms,expires_at,resend_expires_at,resends_left,charge_ref,charged_idr,charge_delivered,created_at,updated_at";

/** PostgREST embed so a listing returns each order's messages in one round-trip. */
const ROW_COLS = `${ORDER_COLS},messages:sms_message(id,code,full_sms,received_at)`;

/** Messages come back unordered from the embed; delivery order is what matters. */
function withSortedMessages(rows: SmsOrderRow[]): SmsOrderRow[] {
  return rows.map((row) => ({
    ...row,
    messages: [...(row.messages ?? [])].sort((a, b) =>
      a.received_at.localeCompare(b.received_at),
    ),
  }));
}

/** Terminal states never need another provider round-trip. */
const OPEN_STATUSES: SmsOrderStatus[] = ["pending"];

/**
 * Cap on numbers a single user may hold at once. Each open order costs real
 * credit until it expires, so an accidental double-click shouldn't drain the
 * balance.
 */
const MAX_OPEN_ORDERS = 3;

/* -------------------------------------------------------------------------- */
/*  Availability                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What the order panel is allowed to know.
 *
 * Deliberately carries neither the SMSPool account balance nor the wholesale
 * price: both are the operator's business, not the buyer's. Withholding them
 * from the payload — rather than merely not rendering them — is what actually
 * keeps them out of reach, since anything sent to the browser is readable in
 * DevTools. The affordability check is collapsed into `canOrder` server-side.
 */
export type SmsAvailability = {
  country: string;
  service: string;
  /** Flat retail price shown to the buyer. */
  priceIdr: number;
  successRate: number;
  stock: number;
  /** False when stock is empty or the operator can't cover another number. */
  canOrder: boolean;
};

/**
 * Availability for the configured country/service.
 *
 * Deliberately says nothing about the buyer's wallet: provider state and wallet
 * state fail for different reasons ("out of stock" vs "top up"), need different
 * messages, and this call still has to render when SMSPool is unreachable.
 *
 * The three provider calls are independent, so they run together — a slow stock
 * lookup shouldn't serialize behind pricing.
 */
export async function getAvailability(): Promise<SmsAvailability> {
  const country = smspoolCountry();
  const [providerBalance, pricing, stock] = await Promise.all([
    getProviderBalance(),
    getPrice(country, OPENAI_SERVICE_ID),
    getStock(country, OPENAI_SERVICE_ID),
  ]);

  const maxPrice = smspoolMaxPrice();
  const affordable = providerBalance >= pricing.price;
  const withinCap = maxPrice == null || pricing.price <= maxPrice;

  return {
    country,
    service: OPENAI_SERVICE_NAME,
    priceIdr: SMS_PRICE_IDR,
    successRate: pricing.successRate,
    stock,
    canOrder: stock > 0 && affordable && withinCap,
  };
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

export async function listOrders(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<SmsOrderRow[]> {
  const { data, error } = await supabase
    .from("sms_order")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<SmsOrderRow[]>();
  if (error) throw error;
  return withSortedMessages(data ?? []);
}

export type OrderPage = {
  orders: SmsOrderRow[];
  /** Orders across the whole history, not just this page. */
  total: number;
};

/**
 * One page of the user's orders, newest first, with the total row count.
 *
 * `page` is 1-based and clamped — it comes from the query string, so it can be
 * anything.
 */
export async function listOrdersPage(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number,
): Promise<OrderPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * pageSize;

  const { count, error: countError } = await supabase
    .from("sms_order")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;

  // The count comes first because PostgREST answers a range that starts past
  // the last row with 416 PGRST103 — an error, not an empty list. Anyone can
  // type `?page=999`, and that must not be a crash.
  const total = count ?? 0;
  if (from >= total) return { orders: [], total };

  const { data, error } = await supabase
    .from("sms_order")
    .select(ROW_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)
    .returns<SmsOrderRow[]>();
  if (error) throw error;

  return { orders: withSortedMessages(data ?? []), total };
}

/**
 * Every code the user has ever received, counted across all their orders.
 *
 * Counted at the database rather than by summing the embedded messages of the
 * page on screen, which would shrink as the reader pages back through history.
 *
 * `sms_message` carries no `user_id`; ownership comes from the parent order.
 * RLS enforces that already, but the `!inner` join filter states it in the
 * query too — the same belt-and-braces as `getOwnedOrder`, so this can never
 * report a global count if it is ever handed a privileged client.
 */
export async function deliveredCodeTotal(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("sms_message")
    .select("id,sms_order!inner(user_id)", { count: "exact", head: true })
    .eq("sms_order.user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Load one order, scoped to its owner. RLS already blocks cross-user reads;
 * the explicit `user_id` filter makes the 404-vs-403 distinction impossible to
 * probe — a stranger's order is simply "not found".
 */
async function getOwnedOrder(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<SmsOrderRow> {
  const { data, error } = await supabase
    .from("sms_order")
    .select(ROW_COLS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<SmsOrderRow>();
  if (error) throw error;
  if (!data) throw new ApiError(404, "NOT_FOUND", "Order not found.");
  return withSortedMessages([data])[0];
}

/* -------------------------------------------------------------------------- */
/*  Ordering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Give a charge back to the wallet.
 *
 * Keyed on the order's `charge_ref`, which the ledger holds a unique index on,
 * so calling this twice for the same order credits once. That matters: a refund
 * can be triggered by an explicit cancel and by the refresh loop noticing the
 * same order expired.
 *
 * Orders placed before the wallet existed have no charge to return.
 */
async function refundCharge(
  supabase: SupabaseClient,
  chargeRef: string | null,
  amountIdr: number | null,
  description: string,
): Promise<void> {
  if (!chargeRef || !amountIdr || amountIdr <= 0) return;
  try {
    await creditBalance(supabase, {
      amountIdr,
      kind: "sms_refund",
      reference: chargeRef,
      description,
    });
  } catch (err) {
    // The order state is already correct; a failed refund must not undo it.
    // Logged with the ref so it can be settled by hand.
    console.error("[sms] refund failed", chargeRef, err);
  }
}

/**
 * Rent a number for OpenAI verification and record it against the user.
 *
 * The wallet is debited FIRST, before any provider credit is spent: a buyer who
 * can't pay must not be able to place the order at all. Everything after that
 * point compensates on failure, so a charge never survives without a number.
 */
export async function createOrder(
  supabase: SupabaseClient,
  userId: string,
): Promise<SmsOrderRow> {
  const { count, error: countError } = await supabase
    .from("sms_order")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", OPEN_STATUSES);
  if (countError) throw countError;

  if ((count ?? 0) >= MAX_OPEN_ORDERS) {
    throw new ApiError(
      409,
      "TOO_MANY_OPEN_ORDERS",
      `You already have ${MAX_OPEN_ORDERS} active numbers. Cancel one or wait for it to expire.`,
    );
  }

  // Minted up front so the debit has an idempotency key that the order row can
  // later be matched to — including when the row never gets written.
  const chargeRef = randomUUID();
  const price = SMS_PRICE_IDR;
  await debitBalance(supabase, {
    amountIdr: price,
    kind: "sms_order",
    reference: chargeRef,
    description: `${OPENAI_SERVICE_NAME} number`,
  });

  const country = smspoolCountry();
  let order: Awaited<ReturnType<typeof orderSms>>;
  try {
    order = await orderSms({
      country,
      service: OPENAI_SERVICE_ID,
      maxPrice: smspoolMaxPrice(),
    });
  } catch (err) {
    await refundCharge(supabase, chargeRef, price, "Refund — number unavailable");
    throw err;
  }

  const cost = Number(order.cost);
  const { data, error } = await supabase
    .from("sms_order")
    .insert({
      user_id: userId,
      order_id: order.order_id,
      phone_number: String(order.number),
      country: order.country || country,
      service: order.service || OPENAI_SERVICE_NAME,
      service_id: OPENAI_SERVICE_ID,
      pool: order.pool != null ? String(order.pool) : null,
      cost: Number.isFinite(cost) ? cost : null,
      charge_ref: chargeRef,
      charged_idr: price,
      charge_delivered: false,
      status: "pending",
      expires_at: order.expiration
        ? new Date(order.expiration * 1000).toISOString()
        : null,
    })
    .select(ROW_COLS)
    .single<SmsOrderRow>();

  // The number is already paid for at this point, so a failed insert would
  // orphan it — refund the buyer (the number is unreachable for them either way)
  // and surface the order id so the provider side can be recovered manually.
  if (error) {
    console.error("[sms] order persisted failed", order.order_id, error);
    await refundCharge(supabase, chargeRef, price, "Refund — order could not be saved");
    throw new ApiError(
      500,
      "SMS_ORDER_NOT_SAVED",
      `Number ${order.number} was ordered but could not be saved (order ${order.order_id}).`,
    );
  }
  return data;
}

/* -------------------------------------------------------------------------- */
/*  Refresh                                                                    */
/* -------------------------------------------------------------------------- */

type OrderPatch = {
  status?: SmsOrderStatus;
  code?: string | null;
  full_sms?: string | null;
  expires_at?: string | null;
  resend_expires_at?: string | null;
  resends_left?: number | null;
  resend_cost?: number | null;
  charge_ref?: string | null;
  charged_idr?: number | null;
  charge_delivered?: boolean;
  updated_at: string;
};

/**
 * Append a received SMS to the order's message log.
 *
 * Callers only invoke this on a *transition* — when the code SMSPool reports
 * differs from the one already on the order — so the 5-second poll can't append
 * the same message repeatedly.
 */
async function recordMessage(
  supabase: SupabaseClient,
  orderRowId: string,
  code: string,
  fullSms: string | null,
): Promise<void> {
  const { error } = await supabase.from("sms_message").insert({
    sms_order_id: orderRowId,
    code,
    full_sms: fullSms,
  });
  // The log is a record, not the source of truth — the code still lands on the
  // order row, so a failed append must not fail the refresh.
  if (error) console.error("[sms] message log failed", orderRowId, error);
}

/**
 * Ask SMSPool how much resend life the number has left and fold it into a
 * patch. Best-effort: the resend window is supplementary information, so a
 * provider error leaves the existing values untouched.
 */
async function resendInfoPatch(orderId: string): Promise<Partial<OrderPatch>> {
  try {
    const info = await checkResend(orderId);
    return {
      resends_left: info.resendsLeft,
      resend_cost: info.cost,
      resend_expires_at:
        info.expiresInHours != null
          ? new Date(Date.now() + info.expiresInHours * 3_600_000).toISOString()
          : null,
    };
  } catch (err) {
    console.error("[sms] resend info lookup failed", orderId, err);
    return {};
  }
}

async function applyPatch(
  supabase: SupabaseClient,
  id: string,
  patch: OrderPatch,
): Promise<SmsOrderRow | null> {
  const { data, error } = await supabase
    .from("sms_order")
    .update(patch)
    .eq("id", id)
    .select(ROW_COLS)
    .maybeSingle<SmsOrderRow>();
  if (error) throw error;
  return data;
}

/**
 * Return the charge for a request that ended without delivering an SMS.
 *
 * Deliberately keyed on `charge_delivered`, not on status. Status cannot answer
 * this: a resend puts the row back to `pending` while it still carries the code
 * from the earlier request that was already paid for and honoured. Refunding on
 * status let a buyer order, take the code, resend, cancel, and walk away with a
 * free number — the charge being returned was the settled one, not the failed
 * one.
 *
 * `row` must be the state BEFORE the transition being settled, so the flag
 * describes the request that just ended.
 */
async function settleRefund(
  supabase: SupabaseClient,
  row: SmsOrderRow,
  status: SmsOrderStatus,
): Promise<void> {
  if (row.charge_delivered) return;
  if (status === "pending") return;
  await refundCharge(
    supabase,
    row.charge_ref,
    row.charged_idr,
    `Refund — request ${status}`,
  );
}

/**
 * True once the window for the awaited SMS has passed. This is the SHORT clock
 * (~20 minutes, reset by a resend) — not the ~120-hour resend window, which
 * `resend_expires_at` tracks separately.
 */
function isExpired(row: SmsOrderRow): boolean {
  return row.expires_at != null && new Date(row.expires_at).getTime() <= Date.now();
}

/**
 * Reconcile the user's pending orders against SMSPool and return the full,
 * up-to-date list.
 *
 * Uses /request/active (one call for every open order) rather than /sms/check
 * per order, which SMSPool rate-limits. Orders that have dropped off the active
 * list are resolved individually: still-open ones get a /sms/check, and ones
 * past their expiry are closed out locally so they can't poll forever.
 */
export async function refreshOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<SmsOrderRow[]> {
  const rows = await listOrders(supabase, userId);
  const pending = rows.filter((r) => r.status === "pending");
  if (pending.length === 0) return rows;

  let active: Awaited<ReturnType<typeof listActive>>;
  try {
    active = await listActive();
  } catch (err) {
    // A provider hiccup shouldn't blank the list — serve what we have.
    console.error("[sms] active order lookup failed", err);
    return rows;
  }

  const byOrderId = new Map(active.map((o) => [o.order_code, o]));
  const patched = new Map<string, SmsOrderRow>();

  for (const row of pending) {
    const live = byOrderId.get(row.order_id);
    const now = new Date().toISOString();

    if (live) {
      // "0" is SMSPool's placeholder for "no SMS yet". After a resend SMSPool
      // keeps reporting the PREVIOUS code until a new SMS actually lands, so a
      // code equal to the one already on the row means we're still waiting.
      const reported = live.code && live.code !== "0" ? live.code : null;
      const code = reported && reported !== row.code ? reported : null;
      if (code) {
        await recordMessage(supabase, row.id, code, live.full_code || null);
        const updated = await applyPatch(supabase, row.id, {
          status: "completed",
          code,
          full_sms: live.full_code || null,
          // The request in flight produced its SMS, so its charge is earned.
          charge_delivered: true,
          ...(await resendInfoPatch(row.order_id)),
          updated_at: now,
        });
        if (updated) patched.set(row.id, updated);
      } else if (isExpired(row)) {
        // The first-SMS window lapsed while the number is still listed. It stays
        // resendable for days, so this is "no code yet", not a dead order.
        const status: SmsOrderStatus = row.code ? "completed" : "expired";
        const updated = await applyPatch(supabase, row.id, {
          status,
          ...(await resendInfoPatch(row.order_id)),
          updated_at: now,
        });
        if (updated) patched.set(row.id, updated);
        await settleRefund(supabase, row, status);
      }
      continue;
    }

    // Gone from the active list: either it finished, or it lapsed.
    let next: OrderPatch | null = null;
    let newCode: { code: string; fullSms: string | null } | null = null;
    try {
      const check = await checkSms(row.order_id);
      // Same stale-code guard as the active-list branch above.
      const fresh = check.code && check.code !== row.code;
      if (check.status === "completed" && fresh && check.code) {
        newCode = { code: check.code, fullSms: check.fullSms };
        next = {
          status: "completed",
          code: check.code,
          full_sms: check.fullSms,
          charge_delivered: true,
          ...(await resendInfoPatch(row.order_id)),
          updated_at: now,
        };
      } else if (check.status !== "pending" && check.status !== "completed") {
        next = { status: check.status, updated_at: now };
      } else if (isExpired(row)) {
        // A number that already delivered at least one code is not expired —
        // it simply has no NEW message yet, and remains resendable.
        next = {
          status: row.code ? "completed" : "expired",
          ...(await resendInfoPatch(row.order_id)),
          updated_at: now,
        };
      }
    } catch (err) {
      // Provider can't tell us; fall back to the local expiry clock.
      console.error("[sms] check failed", row.order_id, err);
      if (isExpired(row)) {
        next = { status: row.code ? "completed" : "expired", updated_at: now };
      }
    }

    if (next) {
      if (newCode) {
        await recordMessage(supabase, row.id, newCode.code, newCode.fullSms);
      }
      const updated = await applyPatch(supabase, row.id, next);
      if (updated) patched.set(row.id, updated);
      // A transition that carries a new code delivered what it was paid for;
      // `row` still shows the pre-patch flag, so skip it explicitly.
      if (next.status && !newCode) await settleRefund(supabase, row, next.status);
    }
  }

  return rows.map((r) => patched.get(r.id) ?? r);
}

/* -------------------------------------------------------------------------- */
/*  Actions                                                                    */
/* -------------------------------------------------------------------------- */

export async function cancelOrder(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ order: SmsOrderRow; message: string }> {
  const row = await getOwnedOrder(supabase, userId, id);
  if (row.status !== "pending") {
    throw new ApiError(
      409,
      "ORDER_NOT_ACTIVE",
      "Only an active order can be cancelled.",
    );
  }

  // SMSPool's own reply is discarded on purpose. It reads "you have been
  // refunded 0.14 dollars" — the operator's wholesale price, in the operator's
  // currency, describing a refund to the operator's account, none of which is
  // the buyer's. What the buyer is told is what moved in THEIR wallet.
  await cancelSms(row.order_id);
  const updated = await applyPatch(supabase, row.id, {
    status: "cancelled",
    updated_at: new Date().toISOString(),
  });
  await settleRefund(supabase, row, "cancelled");

  // Mirrors settleRefund: a request that already delivered its code keeps its
  // money, so the wording must not promise a refund that didn't happen.
  const refunded =
    !row.charge_delivered && row.charge_ref != null && (row.charged_idr ?? 0) > 0;
  const message = refunded
    ? `Number released — ${formatIdr(row.charged_idr as number)} is back in your balance.`
    : "Number released.";
  return { order: updated ?? row, message };
}

export async function resendOrder(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ order: SmsOrderRow; message: string }> {
  const row = await getOwnedOrder(supabase, userId, id);

  // A resend while a request is still in flight would overwrite `charge_ref`
  // and orphan the charge it replaces — unrefundable, because nothing would
  // point at it any more. One request at a time per number.
  if (row.status === "pending") {
    throw new ApiError(
      409,
      "REQUEST_IN_FLIGHT",
      "This number is still waiting for a code. Wait for it or cancel first.",
    );
  }

  // Every request for an SMS is paid for, resends included: the buyer gets
  // another code, and it costs another number's worth of provider time. Charged
  // before the provider is asked, so an unpayable resend never happens.
  const chargeRef = randomUUID();
  const price = SMS_PRICE_IDR;
  await debitBalance(supabase, {
    amountIdr: price,
    kind: "sms_order",
    reference: chargeRef,
    description: `${OPENAI_SERVICE_NAME} number — resend`,
  });

  let message: string;
  try {
    message = await resendSms(row.order_id);
  } catch (err) {
    await refundCharge(supabase, chargeRef, price, "Refund — resend rejected");
    throw err;
  }

  // The delivered code stays on the row. It is still the latest code the user
  // has, and the refresh loop needs it to tell a genuinely new SMS from
  // SMSPool's lingering report of the old one. Past messages live in
  // sms_message, so nothing is lost either way.
  //
  // `expires_at` must move forward: it marks the window for the FIRST SMS
  // (~20 minutes from ordering) and has long passed if the resend happens
  // hours later. Left alone, the very next poll would read the order as
  // expired and kill a number that is good for days. The fresh window reuses
  // the original duration, measured from now.
  const windowMs =
    row.expires_at != null
      ? new Date(row.expires_at).getTime() - new Date(row.created_at).getTime()
      : 0;
  const expiresAt =
    windowMs > 0 ? new Date(Date.now() + windowMs).toISOString() : row.expires_at;

  const updated = await applyPatch(supabase, row.id, {
    status: "pending",
    expires_at: expiresAt,
    // The new request owns the row's charge now, and has delivered nothing yet.
    // The charge it replaces is already settled — that code was received.
    charge_ref: chargeRef,
    charged_idr: price,
    charge_delivered: false,
    ...(await resendInfoPatch(row.order_id)),
    updated_at: new Date().toISOString(),
  });
  return { order: updated ?? row, message };
}
