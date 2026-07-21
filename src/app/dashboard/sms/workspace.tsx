"use client";

import Link from "next/link";
import { useCallback, useEffect, useEffectEvent, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Phone,
  RefreshCw,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";

import type { SmsAvailability, SmsOrderRow } from "@/lib/server/sms-service";
import { formatIdr } from "@/lib/money";
import { SMS_PRICE_IDR, isReusable } from "@/lib/sms-order";
import { copyToClipboard } from "@/lib/utils";

/** How often to ask the server to reconcile pending orders with SMSPool. */
const POLL_INTERVAL_MS = 5_000;

type ApiError = { error?: { message?: string } };

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as ApiError;
  return body.error?.message ?? fallback;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function formatPhone(raw: string): string {
  return raw.startsWith("+") ? raw : `+${raw}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_STYLE: Record<SmsOrderRow["status"], string> = {
  pending: "border-amber-400/25 bg-amber-400/[0.08] text-amber-300",
  completed: "border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]",
  cancelled: "border-white/[0.08] bg-white/[0.04] text-white/45",
  refunded: "border-white/[0.08] bg-white/[0.04] text-white/45",
  expired: "border-red-400/20 bg-red-400/[0.06] text-red-300/80",
};

/* -------------------------------------------------------------------------- */
/*  Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function StatusBadge({ status }: { status: SmsOrderRow["status"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  // Reset the confirmation tick after a beat. Effect (not a bare setTimeout in
  // the handler) so a rapid second copy cancels the first timer.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        if (await copyToClipboard(value)) setCopied(true);
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/50 transition-colors hover:border-white/[0.16] hover:text-white"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/**
 * Seconds remaining on a rental, ticking locally. Server refreshes correct any
 * drift; this only exists so the number doesn't sit frozen between polls.
 *
 * The value is derived during render from a tick counter rather than stored in
 * state. The first render deliberately returns null — the server and the client
 * would otherwise compute different remainders and mismatch on hydration — so
 * the countdown appears one second after mount.
 */
function useCountdown(expiresAt: string | null): number | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return expiresAt && tick > 0 ? secondsUntil(expiresAt) : null;
}

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

/* -------------------------------------------------------------------------- */
/*  Availability strip                                                         */
/* -------------------------------------------------------------------------- */

function AvailabilityStrip({
  availability,
  balanceIdr,
}: {
  availability: SmsAvailability;
  balanceIdr: number;
}) {
  const stats = [
    { label: "Balance", value: formatIdr(balanceIdr) },
    { label: "Price", value: formatIdr(availability.priceIdr) },
    { label: "Success rate", value: `${availability.successRate}%` },
    { label: "Stock", value: availability.stock.toLocaleString("en-US") },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.06] sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-[#171717] px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
            {stat.label}
          </p>
          <p className="mt-1 text-[14px] font-medium text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Active order                                                               */
/* -------------------------------------------------------------------------- */

function ActiveOrderCard({
  order,
  onCancel,
  onResend,
  busy,
  canAffordResend,
}: {
  order: SmsOrderRow;
  onCancel: (id: string) => void;
  onResend: (id: string) => void;
  busy: boolean;
  /** A resend is a new paid request, so an empty wallet blocks it. */
  canAffordResend: boolean;
}) {
  const remaining = useCountdown(order.expires_at);
  const waiting = order.status === "pending";
  const resendNote = describeResend(order);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden />
            <span className="font-mono text-[18px] tracking-[-0.01em] text-white">
              {formatPhone(order.phone_number)}
            </span>
            <CopyButton
              value={formatPhone(order.phone_number)}
              label="Copy phone number"
            />
          </div>
          <p className="mt-1.5 text-[12px] text-white/40">
            {order.service} · {order.country} · {formatIdr(SMS_PRICE_IDR)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {waiting && remaining != null && (
            <span className="font-mono text-[12px] text-white/45">
              {formatCountdown(remaining)}
            </span>
          )}
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="px-5 py-5">
        {order.code ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
              Verification code
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="font-mono text-[28px] font-medium tracking-[0.12em] text-[#3ecf8e]">
                {order.code}
              </span>
              <CopyButton value={order.code} label="Copy verification code" />
            </div>
            {order.full_sms && (
              <p className="mt-3 rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px] leading-relaxed text-white/45">
                {order.full_sms}
              </p>
            )}
          </div>
        ) : waiting ? (
          <div className="flex items-center gap-2.5 text-[13px] text-white/45">
            <Loader2 className="h-4 w-4 animate-spin text-white/30" aria-hidden />
            Waiting for the SMS — enter this number on OpenAI now.
          </div>
        ) : (
          <p className="text-[13px] text-white/40">
            No code was received for this number.
          </p>
        )}

        {/* Full delivery log. A number stays resendable for days, so it can
            collect several codes — the latest is shown above, the rest here. */}
        {order.messages.length > 1 && (
          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="text-[11px] uppercase tracking-[0.06em] text-white/35">
              Earlier codes
            </p>
            <div className="mt-2 space-y-1.5">
              {order.messages
                .slice(0, -1)
                .reverse()
                .map((message) => (
                  <div
                    key={message.id}
                    className="flex flex-wrap items-center gap-2.5"
                  >
                    <span className="font-mono text-[14px] text-white/60">
                      {message.code}
                    </span>
                    <span
                      suppressHydrationWarning
                      className="text-[11px] text-white/30"
                    >
                      {formatTime(message.received_at)}
                    </span>
                    {message.code && (
                      <CopyButton
                        value={message.code}
                        label={`Copy code ${message.code}`}
                      />
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-5 py-3">
        {waiting && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(order.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white disabled:opacity-40"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Cancel &amp; refund
          </button>
        )}
        {/* Hidden while a request is in flight: the server refuses a second one
            on the same number, and the price on the label must never appear
            next to an action that would be rejected. */}
        {isReusable(order) && !waiting && (
          <button
            type="button"
            disabled={busy || !canAffordResend}
            onClick={() => onResend(order.id)}
            title={
              canAffordResend
                ? undefined
                : `A new code costs ${formatIdr(SMS_PRICE_IDR)} — top up first.`
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white disabled:opacity-40"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Request again · {formatIdr(SMS_PRICE_IDR)}
          </button>
        )}
        {resendNote && (
          <span suppressHydrationWarning className="text-[11px] text-white/30">
            {resendNote}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Human summary of the resend allowance: how many are left and how long the
 * number stays usable. Returns null when SMSPool hasn't told us.
 *
 * The price lives on the button, not here — this line is about the allowance.
 * Whatever SMSPool charges the operator for a resend stays out of it either
 * way; the buyer sees only the flat retail price.
 */
function describeResend(order: SmsOrderRow): string | null {
  const parts: string[] = [];

  if (order.resends_left != null) {
    parts.push(
      order.resends_left === 1 ? "1 resend left" : `${order.resends_left} resends left`,
    );
  }
  if (order.resend_expires_at != null) {
    const hours = Math.floor(
      (new Date(order.resend_expires_at).getTime() - Date.now()) / 3_600_000,
    );
    if (hours > 0) parts.push(`usable for ${hours}h more`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/* -------------------------------------------------------------------------- */
/*  Workspace                                                                  */
/* -------------------------------------------------------------------------- */

export function SmsWorkspace({
  initialAvailability,
  initialOrders,
  initialBalanceIdr,
  initialSelectedId,
}: {
  initialAvailability: SmsAvailability | null;
  initialOrders: SmsOrderRow[];
  /** Wallet balance in rupiah — every order debits it, refunds credit it back. */
  initialBalanceIdr: number;
  /** Order to focus on load, from `?order=` — set by the History page. */
  initialSelectedId?: string;
}) {
  const [availability, setAvailability] = useState(initialAvailability);
  const [balanceIdr, setBalanceIdr] = useState(initialBalanceIdr);
  const [orders, setOrders] = useState(initialOrders);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );
  const [ordering, setOrdering] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // An explicit pick wins, so resending an older number keeps it on screen
  // instead of snapping back to the newest order. Falls back to the newest
  // number that is still live or still reusable.
  const active =
    orders.find((o) => o.id === selectedId) ??
    orders.find((o) => o.status === "pending" || isReusable(o));
  const others = orders.filter((o) => o.id !== active?.id).slice(0, 6);
  const hasPending = orders.some((o) => o.status === "pending");

  const refreshBalance = useCallback(async () => {
    const res = await fetch("/api/balance?limit=1", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { balanceIdr: number };
    setBalanceIdr(data.balanceIdr);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/sms/orders", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { orders: SmsOrderRow[] };
    setOrders(data.orders);
    // The same request may have expired an order server-side, which refunds it.
    // Re-reading the wallet here keeps the displayed balance honest without
    // waiting for a provider round-trip.
    void refreshBalance();
  }, [refreshBalance]);

  // One call refreshes both provider state and the wallet — an order, a cancel,
  // and an expiry all move the balance, so they always change together.
  const refreshAvailability = useCallback(async () => {
    const res = await fetch("/api/sms/status", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      availability: SmsAvailability;
      balanceIdr: number;
    };
    setAvailability(data.availability);
    setBalanceIdr(data.balanceIdr);
  }, []);

  // Poll while a number is still waiting for its SMS. Reading `refresh` through
  // an effect event keeps the interval tied only to whether polling is needed,
  // so it isn't torn down and restarted on unrelated re-renders.
  const pollOnce = useEffectEvent(() => {
    void refresh();
  });
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => pollOnce(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending]);

  const handleOrder = useCallback(async () => {
    setOrdering(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/sms/orders", { method: "POST" });
      if (!res.ok) {
        setError(await readError(res, "Could not order a number."));
        return;
      }
      const data = (await res.json()) as { order: SmsOrderRow };
      setOrders((prev) => [data.order, ...prev]);
      // Asking for a number is a newer, more explicit intent than whatever was
      // selected before, so it takes over the panel. Without this a stale pick —
      // an older number opened from History, or one just cancelled — would keep
      // the new number hidden behind it.
      setSelectedId(data.order.id);
      void refreshAvailability();
    } catch {
      setError("Network error while ordering a number.");
    } finally {
      setOrdering(false);
    }
  }, [refreshAvailability]);

  const runAction = useCallback(
    async (id: string, action: "cancel" | "resend") => {
      setBusyId(id);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/sms/orders/${id}/${action}`, {
          method: "POST",
        });
        if (!res.ok) {
          setError(await readError(res, `Could not ${action} this order.`));
          return;
        }
        const data = (await res.json()) as {
          order: SmsOrderRow;
          message: string;
        };
        setOrders((prev) =>
          prev.map((o) => (o.id === data.order.id ? data.order : o)),
        );
        setNotice(data.message);
        void refreshAvailability();
      } catch {
        setError(`Network error while trying to ${action}.`);
      } finally {
        setBusyId(null);
      }
    },
    [refreshAvailability],
  );

  const handleCancel = useCallback(
    (id: string) => void runAction(id, "cancel"),
    [runAction],
  );
  const handleResend = useCallback(
    (id: string) => void runAction(id, "resend"),
    [runAction],
  );

  const outOfStock = availability != null && availability.stock === 0;
  // `canOrder` also covers reasons the buyer has no business seeing (operator
  // balance, price cap), so an unavailable-but-in-stock state stays vague.
  const unavailable =
    availability != null && !availability.canOrder && !outOfStock;
  // The wallet is checked again server-side on every order; this only spares the
  // buyer a request that would come back 402.
  const price = availability?.priceIdr ?? SMS_PRICE_IDR;
  const insufficientBalance = balanceIdr < price;

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium text-white">SMS OTP</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/40">
              Rent a disposable number and receive the OpenAI verification code
              for Codex.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/balance"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
            >
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              {formatIdr(balanceIdr)}
            </Link>
            <button
              type="button"
              onClick={handleOrder}
              disabled={ordering || !availability?.canOrder || insufficientBalance}
              className="inline-flex items-center gap-2 rounded-md bg-[#3ecf8e] px-3.5 py-2 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ordering ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Smartphone className="h-4 w-4" aria-hidden />
              )}
              Get a number
            </button>
          </div>
        </div>

        {/* Wallet gate — the only blocker the buyer can actually clear. */}
        {insufficientBalance && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
            <p className="text-[12px] leading-relaxed text-amber-200/80">
              You need {formatIdr(price)} per number — your balance is{" "}
              {formatIdr(balanceIdr)}.
            </p>
            <Link
              href="/dashboard/balance"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 py-1.5 text-[12px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Top up
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

        {/* Provider state */}
        {availability ? (
          <AvailabilityStrip availability={availability} balanceIdr={balanceIdr} />
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
              aria-hidden
            />
            <p className="text-[12px] leading-relaxed text-amber-200/80">
              The SMS provider is unreachable. Check that{" "}
              <span className="font-mono">SMSPOOL_API_KEY</span> is set, then
              reload.
            </p>
          </div>
        )}

        {outOfStock && (
          <p className="text-[12px] text-white/40">
            No numbers in stock for this country right now — try again shortly.
          </p>
        )}
        {unavailable && (
          <p className="text-[12px] text-white/40">
            Numbers are temporarily unavailable — try again shortly.
          </p>
        )}

        {/* Feedback */}
        {error && (
          <div className="rounded-lg border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-[12px] leading-relaxed text-red-200/80">
            {error}
          </div>
        )}
        {notice && (
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12px] leading-relaxed text-white/50">
            {notice}
          </div>
        )}

        {/* Active number */}
        {active ? (
          <ActiveOrderCard
            order={active}
            onCancel={handleCancel}
            onResend={handleResend}
            busy={busyId === active.id}
            canAffordResend={balanceIdr >= price}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
            <Smartphone className="h-8 w-8 text-white/10" aria-hidden />
            <p className="max-w-xs text-[13px] leading-relaxed text-white/30">
              No number yet. Use “Get a number” above, then enter it on OpenAI’s
              verification screen.
            </p>
          </div>
        )}

        {/* Other numbers — selecting one opens it in the card above, which is
            the only way to reach the resend action for an older number. */}
        {others.length > 0 && (
          <div>
            <h3 className="text-[13px] font-medium text-white/70">
              Your other numbers
            </h3>
            <p className="mt-0.5 text-[12px] text-white/35">
              Select one to open it — numbers stay usable for about 120 hours.
            </p>
            <div className="mt-2 space-y-2">
              {others.map((order) => {
                const reusable = isReusable(order);
                return (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#171717] px-4 py-3 text-left transition-colors hover:border-white/[0.16] hover:bg-white/[0.03]"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[13px] text-white/80">
                        {formatPhone(order.phone_number)}
                      </p>
                      {/* Rendered in the server's timezone during SSR and the
                          viewer's after hydration — the difference is expected. */}
                      <p
                        suppressHydrationWarning
                        className="mt-0.5 text-[11px] text-white/35"
                      >
                        {formatTime(order.created_at)} ·{" "}
                        {formatIdr(SMS_PRICE_IDR)}
                        {reusable && " · reusable"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.code && (
                        <span className="font-mono text-[13px] text-[#3ecf8e]">
                          {order.code}
                        </span>
                      )}
                      <StatusBadge status={order.status} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
