import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { getBalance } from "@/lib/server/balance-service";
import {
  getAvailability,
  listOrders,
  type SmsAvailability,
  type SmsOrderRow,
} from "@/lib/server/sms-service";

import { SmsWorkspace } from "./workspace";

export default async function SmsPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: selectedId } = await searchParams;
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/sms");

  // The provider lookup is best-effort: if SMSPool is down or the key is
  // missing, the page still renders the user's existing orders and the client
  // surfaces the problem on its next refresh.
  let availability: SmsAvailability | null = null;
  try {
    availability = await getAvailability();
  } catch (err) {
    console.error("[sms] availability lookup failed", err);
  }

  let orders: SmsOrderRow[] = [];
  try {
    orders = await listOrders(supabase, user.id, 10);
  } catch (err) {
    console.error("[sms] order list failed", err);
  }

  const balanceIdr = await getBalance(supabase, user.id);

  return (
    <SmsWorkspace
      initialAvailability={availability}
      initialOrders={orders}
      initialBalanceIdr={balanceIdr}
      initialSelectedId={selectedId}
    />
  );
}
