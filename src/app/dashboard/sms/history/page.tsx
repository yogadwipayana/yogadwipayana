import { ArrowRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { formatIdr } from "@/lib/money";
import { SMS_PRICE_IDR, isReusable } from "@/lib/sms-order";
import { Pagination } from "@/components/ui/Pagination";
import { smsSpendIdr } from "@/lib/server/balance-service";
import {
  deliveredCodeTotal,
  listOrdersPage,
  type SmsOrderRow,
} from "@/lib/server/sms-service";

const PAGE_SIZE = 10;

const STATUS_STYLE: Record<SmsOrderRow["status"], string> = {
  pending: "border-amber-400/25 bg-amber-400/[0.08] text-amber-300",
  completed: "border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]",
  cancelled: "border-white/[0.08] bg-white/[0.04] text-white/45",
  refunded: "border-white/[0.08] bg-white/[0.04] text-white/45",
  expired: "border-red-400/20 bg-red-400/[0.06] text-red-300/80",
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function SmsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/sms/history");

  // Spend and delivered codes are lifetime figures; only the list is paged.
  const [{ orders, total }, spent, delivered] = await Promise.all([
    listOrdersPage(supabase, user.id, page, PAGE_SIZE),
    smsSpendIdr(supabase, user.id),
    deliveredCodeTotal(supabase, user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
        <div>
          <h2 className="text-[18px] font-medium text-white">History</h2>
          <p className="mt-1 text-[13px] text-white/40">
            Every number you have rented — {total} total,{" "}
            {formatIdr(spent)} spent on {delivered}{" "}
            {delivered === 1 ? "delivered code" : "delivered codes"}. Each
            request costs {formatIdr(SMS_PRICE_IDR)}; a request that never
            delivers is credited back.
          </p>
        </div>

        {total === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
            <Smartphone className="h-8 w-8 text-white/10" aria-hidden />
            <p className="text-[13px] text-white/30">No numbers rented yet.</p>
          </div>
        ) : orders.length === 0 ? (
          // Reachable by editing `?page=` past the end.
          <div className="flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-[#171717] py-14 text-center">
            <Smartphone className="h-8 w-8 text-white/10" aria-hidden />
            <p className="text-[13px] text-white/30">
              Nothing on this page — there are {totalPages}.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]">
            {orders.map((order, index) => (
              <div
                key={order.id}
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
                  index > 0 ? "border-t border-white/[0.06]" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="font-mono text-[13px] text-white/85">
                    +{order.phone_number}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/35">
                    {formatTime(order.created_at)} · {order.country} ·{" "}
                    {order.messages.length}{" "}
                    {order.messages.length === 1 ? "code" : "codes"}
                    {/* Per-request billing means a row has no single price:
                        `charged_idr` is only its latest charge. The ledger on
                        the Balance page is where the money is itemised. */}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {order.code && (
                    <span className="font-mono text-[13px] text-[#3ecf8e]">
                      {order.code}
                    </span>
                  )}
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${STATUS_STYLE[order.status]}`}
                  >
                    {order.status}
                  </span>
                  {/* Still inside its ~120-hour resend window: open it in the
                      order panel, where "Request again" lives. */}
                  {isReusable(order) && (
                    <Link
                      href={`/dashboard/sms?order=${order.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60 transition-colors hover:border-white/[0.16] hover:text-white"
                    >
                      Reuse
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          hrefFor={(target) => `?page=${target}`}
        />
      </div>
    </div>
  );
}
