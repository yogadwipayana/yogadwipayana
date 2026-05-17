import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { getCatalog } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const catalog = await getCatalog(user.id);
    return ok(catalog);
  } catch (err) {
    return fail(err);
  }
}
