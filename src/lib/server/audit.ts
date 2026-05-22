import { cookies, headers } from "next/headers";

import { getClientIp } from "@/lib/server/rate-limit";
import { createClient } from "@/utils/supabase/server";

/**
 * Append a row to `public.audit_log`. Best-effort: failures are logged but
 * never thrown, so a logging hiccup can't break the user-visible action.
 *
 * Authenticated callers go through the cookie-bound supabase client, so the
 * RLS owner-insert policy enforces that user_id matches the JWT.
 */
export async function recordAudit(args: {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createClient(await cookies());
    const reqHeaders = await headers().catch(() => null);
    const ip = reqHeaders ? getClientIp(reqHeaders) ?? null : null;
    const userAgent = reqHeaders?.get("user-agent") ?? null;

    await supabase.from("audit_log").insert({
      user_id: args.userId,
      action: args.action,
      resource_type: args.resourceType ?? null,
      resource_id: args.resourceId ?? null,
      ip,
      user_agent: userAgent,
      metadata: args.metadata ?? null,
    });
  } catch (err) {
    console.error(
      "[audit] failed to write audit row:",
      err instanceof Error ? err.message : err,
    );
  }
}
