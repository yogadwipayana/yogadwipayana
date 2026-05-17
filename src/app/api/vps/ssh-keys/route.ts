import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { listSshKeys } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    const keys = await listSshKeys(user.id);
    return ok({ keys });
  } catch (err) {
    return fail(err);
  }
}
