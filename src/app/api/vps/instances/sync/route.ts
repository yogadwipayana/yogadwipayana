import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import {
  listUserInstances,
  syncAllInstances,
} from "@/lib/server/dashboard-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/vps/instances/sync — re-sync the user's instances from Tencent
 * Cloud. Replaces the previous GET-with-?refresh=true side effect (which
 * would have been CSRF-able) with an explicit state-changing request.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    await checkRateLimit(
      ratelimits.connectCloud,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "instance sync",
    );
    await syncAllInstances(user.id);
    const instances = await listUserInstances(user.id);
    return ok({ instances });
  } catch (err) {
    return fail(err);
  }
}
