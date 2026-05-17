import { requireUser } from "@/lib/server/auth-session";
import { ApiError, fail, ok } from "@/lib/server/api-response";
import { performInstanceAction } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; action: string }> },
) {
  try {
    const user = await requireUser();
    const { id, action } = await context.params;
    if (!["start", "stop", "reboot"].includes(action)) {
      throw new ApiError(400, "INVALID_ACTION", "Action must be start, stop, or reboot");
    }
    const operation = await performInstanceAction({
      userId: user.id,
      instanceId: id,
      action: action as "start" | "stop" | "reboot",
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
