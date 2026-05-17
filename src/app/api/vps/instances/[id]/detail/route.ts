import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { getInstanceDetail } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";
    const detail = await getInstanceDetail(user.id, id, { refresh });
    return ok(detail);
  } catch (err) {
    return fail(err);
  }
}
