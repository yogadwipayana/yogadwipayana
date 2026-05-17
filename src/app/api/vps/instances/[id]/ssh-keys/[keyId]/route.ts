import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { unbindSshKeyFromInstance } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; keyId: string }> },
) {
  try {
    const user = await requireUser();
    const { id, keyId } = await context.params;
    const operation = await unbindSshKeyFromInstance(user.id, id, keyId);
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
