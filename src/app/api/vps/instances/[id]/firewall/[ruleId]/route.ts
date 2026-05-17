import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { removeFirewallRule } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; ruleId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, ruleId } = await context.params;
    const operation = await removeFirewallRule({
      userId: user.id,
      instanceId: id,
      ruleId,
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
