import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { listUserInstances, syncAllInstances } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";
    if (refresh) await syncAllInstances(user.id);
    const instances = await listUserInstances(user.id);
    return ok({ instances });
  } catch (err) {
    return fail(err);
  }
}
