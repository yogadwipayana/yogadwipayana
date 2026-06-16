import { requireUser } from "@/lib/server/auth-session";
import { ApiError, fail, ok } from "@/lib/server/api-response";
import { recordAudit } from "@/lib/server/audit";
import { performInstanceAction } from "@/lib/server/dashboard-service";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const [user, { id, action }] = await Promise.all([
      requireUser(),
      context.params,
    ]);
    await checkRateLimit(
      ratelimits.vpsAction,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "VPS power action",
    );
    if (!["start", "stop", "reboot"].includes(action)) {
      throw new ApiError(400, "INVALID_ACTION", "Action must be start, stop, or reboot");
    }
    const operation = await performInstanceAction({
      userId: user.id,
      instanceId: id,
      action: action as "start" | "stop" | "reboot",
    });
    await recordAudit({
      userId: user.id,
      action: `vps.${action}`,
      resourceType: "instance",
      resourceId: id,
      metadata: { request_id: operation.requestId },
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
