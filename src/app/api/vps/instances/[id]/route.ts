import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { removeUserInstance } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await removeUserInstance(user.id, id);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
