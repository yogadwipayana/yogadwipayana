/**
 * Prepaid rupiah wallet — the gate in front of every paid tool.
 *
 * All money movement goes through the `credit_balance` / `debit_balance`
 * Postgres functions: they update the balance and append the ledger entry in one
 * transaction, and the ledger's unique (kind, reference) index makes both
 * operations idempotent. Nothing here writes to the tables directly, and RLS
 * grants no INSERT/UPDATE, so a bug in this file cannot mint credit.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "./api-response";
import {
  VoucherClaimError,
  claimSmsVoucher,
  releaseSmsVoucher,
} from "./ai-admin";

export type BalanceTransactionKind =
  | "topup"
  | "sms_order"
  | "sms_refund"
  | "adjustment";

export type BalanceTransactionRow = {
  id: string;
  /** Positive for credits, negative for debits. Whole rupiah. */
  amount_idr: number;
  kind: BalanceTransactionKind;
  reference: string | null;
  description: string | null;
  balance_after: number;
  created_at: string;
};

const TRANSACTION_COLS =
  "id,amount_idr,kind,reference,description,balance_after,created_at";

/** Postgres unique-violation — our idempotency guard tripping. */
const UNIQUE_VIOLATION = "23505";

function isDuplicate(error: PostgrestError | null): boolean {
  return error?.code === UNIQUE_VIOLATION;
}

/* -------------------------------------------------------------------------- */
/*  Reads                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The user's balance in whole rupiah. A user who has never topped up has no row
 * yet, which reads as zero rather than an error.
 */
export async function getBalance(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("user_balance")
    .select("balance_idr")
    .eq("user_id", userId)
    .maybeSingle<{ balance_idr: number }>();
  if (error) throw error;
  return data?.balance_idr ?? 0;
}

export async function listTransactions(
  supabase: SupabaseClient,
  userId: string,
  limit = 50,
): Promise<BalanceTransactionRow[]> {
  const { data, error } = await supabase
    .from("balance_transaction")
    .select(TRANSACTION_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<BalanceTransactionRow[]>();
  if (error) throw error;
  return data ?? [];
}

export type TransactionPage = {
  transactions: BalanceTransactionRow[];
  /** Entries across the whole ledger, not just this page. */
  total: number;
};

/**
 * One page of the ledger, newest first, plus the total row count so the caller
 * can render a pager.
 *
 * `page` is 1-based and clamped, because it arrives from the query string where
 * anyone can type `?page=-3`.
 */
export async function listTransactionsPage(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number,
): Promise<TransactionPage> {
  const safePage = Math.max(1, Math.floor(page) || 1);
  const from = (safePage - 1) * pageSize;

  const { count, error: countError } = await supabase
    .from("balance_transaction")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;

  // Counted first: a range starting past the last row is a 416 from PostgREST,
  // not an empty result, and `?page=999` is a URL anyone can type.
  const total = count ?? 0;
  if (from >= total) return { transactions: [], total };

  const { data, error } = await supabase
    .from("balance_transaction")
    .select(TRANSACTION_COLS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1)
    .returns<BalanceTransactionRow[]>();
  if (error) throw error;

  return { transactions: data ?? [], total };
}

export type LedgerTotals = {
  toppedUpIdr: number;
  spentIdr: number;
};

/**
 * Lifetime credit and debit totals.
 *
 * Read separately from the page of entries on purpose: a summary that only
 * counted the rows currently on screen would change every time the reader
 * clicked "Next", which is worse than no summary at all. Only the amount column
 * is fetched, so this stays cheap as the ledger grows.
 */
export async function ledgerTotals(
  supabase: SupabaseClient,
  userId: string,
): Promise<LedgerTotals> {
  const { data, error } = await supabase
    .from("balance_transaction")
    .select("amount_idr,kind")
    .eq("user_id", userId)
    .returns<{ amount_idr: number; kind: BalanceTransactionKind }[]>();
  if (error) throw error;

  let toppedUpIdr = 0;
  let spentIdr = 0;
  for (const tx of data ?? []) {
    if (tx.kind === "topup") {
      toppedUpIdr += tx.amount_idr;
      continue;
    }
    // Everything else is spending or its reversal. Debits are negative and
    // refunds positive, so subtracting both nets the refunds out — a number
    // that was credited back was never really spent.
    spentIdr -= tx.amount_idr;
  }
  return { toppedUpIdr, spentIdr };
}

/**
 * Net rupiah the user has spent on SMS: every request debited, less every
 * refund credited back.
 *
 * Read from the ledger rather than summed off `sms_order`, because billing is
 * per request — one number charged for its order and two resends leaves only
 * the last charge on the row, while all three sit here.
 */
export async function smsSpendIdr(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("balance_transaction")
    .select("amount_idr")
    .eq("user_id", userId)
    .in("kind", ["sms_order", "sms_refund"])
    .returns<{ amount_idr: number }[]>();
  if (error) throw error;
  // Debits are stored negative; flip the total so it reads as an amount spent.
  return -(data ?? []).reduce((sum, tx) => sum + tx.amount_idr, 0);
}

/* -------------------------------------------------------------------------- */
/*  Money movement                                                             */
/* -------------------------------------------------------------------------- */

type MovementArgs = {
  /** Whole rupiah, always positive — the direction comes from the function. */
  amountIdr: number;
  kind: BalanceTransactionKind;
  /** Idempotency handle: voucher code, or an order's charge ref. */
  reference?: string | null;
  description?: string | null;
};

export type CreditResult = {
  balanceIdr: number;
  /** True when this reference was already credited, so nothing moved. */
  duplicate: boolean;
};

/**
 * Add credit. Re-crediting the same reference is a no-op rather than an error,
 * which is what lets a refund be retried safely from more than one code path.
 */
export async function creditBalance(
  supabase: SupabaseClient,
  { amountIdr, kind, reference = null, description = null }: MovementArgs,
): Promise<CreditResult> {
  const { data, error } = await supabase.rpc("credit_balance", {
    p_amount: amountIdr,
    p_kind: kind,
    p_reference: reference,
    p_description: description,
  });

  if (isDuplicate(error)) {
    return { balanceIdr: await currentBalance(supabase), duplicate: true };
  }
  if (error) throw error;
  return { balanceIdr: Number(data ?? 0), duplicate: false };
}

/**
 * Spend credit. Throws 402 when the wallet can't cover it — the balance check
 * and the deduction are the same statement, so two concurrent orders cannot both
 * pass it.
 */
export async function debitBalance(
  supabase: SupabaseClient,
  { amountIdr, kind, reference = null, description = null }: MovementArgs,
): Promise<number> {
  const { data, error } = await supabase.rpc("debit_balance", {
    p_amount: amountIdr,
    p_kind: kind,
    p_reference: reference,
    p_description: description,
  });

  if (error) {
    if (error.message?.includes("INSUFFICIENT_BALANCE")) {
      throw new ApiError(
        402,
        "INSUFFICIENT_BALANCE",
        "Not enough balance. Top up on the Balance page and try again.",
      );
    }
    throw error;
  }
  return Number(data ?? 0);
}

/** Balance read used after a duplicate credit, where the RPC returned nothing. */
async function currentBalance(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from("user_balance")
    .select("balance_idr")
    .maybeSingle<{ balance_idr: number }>();
  if (error) throw error;
  return data?.balance_idr ?? 0;
}

/* -------------------------------------------------------------------------- */
/*  Voucher top-up                                                             */
/* -------------------------------------------------------------------------- */

export type RedeemResult = {
  code: string;
  amountIdr: number;
  balanceIdr: number;
};

/**
 * Turn a voucher code into balance.
 *
 * The code lives in the AI Router's database (one admin surface issues both AI
 * and SMS vouchers) while the wallet lives here, so this is a two-step saga:
 * claim upstream, then credit locally. If the credit fails the claim is handed
 * back, leaving the buyer with a code they can retry rather than a spent code
 * and no balance.
 */
export async function redeemVoucher(
  supabase: SupabaseClient,
  email: string,
  rawCode: string,
): Promise<RedeemResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code || code.length > 64) {
    throw new ApiError(400, "INVALID_CODE", "Enter a valid voucher code.");
  }

  let claimed;
  try {
    claimed = await claimSmsVoucher(code, email);
  } catch (err) {
    if (err instanceof VoucherClaimError) {
      throw new ApiError(
        err.clientFault ? 400 : 502,
        err.clientFault ? "VOUCHER_REJECTED" : "VOUCHER_SERVICE_ERROR",
        err.message,
      );
    }
    throw err;
  }

  try {
    const { balanceIdr, duplicate } = await creditBalance(supabase, {
      amountIdr: claimed.amountIdr,
      kind: "topup",
      reference: claimed.code,
      description: `Voucher ${claimed.code}`,
    });

    // Already credited: the code was claimed and applied by an earlier attempt
    // whose response the buyer never saw. Report the balance, don't double it.
    return { code: claimed.code, amountIdr: duplicate ? 0 : claimed.amountIdr, balanceIdr };
  } catch (err) {
    const released = await releaseSmsVoucher(claimed.code, email);
    console.error(
      `[balance] voucher credit failed for ${claimed.code} (released: ${released})`,
      err,
    );
    throw new ApiError(
      500,
      "TOPUP_FAILED",
      released
        ? "Top-up failed and the voucher was returned — please try again."
        : `Top-up failed. Contact support with voucher ${claimed.code}.`,
    );
  }
}
