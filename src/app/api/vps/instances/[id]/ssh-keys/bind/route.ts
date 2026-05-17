import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { bindSshKeyToInstance } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const schema = z.object({
  keyId: z.string().min(1),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const operation = await bindSshKeyToInstance(user.id, id, payload.keyId);
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
