import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { reorderUserInstances } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const payloadSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { orderedIds } = payloadSchema.parse(await request.json());
    const result = await reorderUserInstances(user.id, orderedIds);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
