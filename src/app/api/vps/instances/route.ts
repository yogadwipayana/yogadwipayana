import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { listUserInstances } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const instances = await listUserInstances(user.id);
    return ok({ instances });
  } catch (err) {
    return fail(err);
  }
}
