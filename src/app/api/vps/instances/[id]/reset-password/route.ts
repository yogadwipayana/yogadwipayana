import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { recordAudit } from "@/lib/server/audit";
import { performResetPassword } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const schema = z.object({
  username: z.string().min(1).max(50).default("ubuntu"),
  password: z.string().min(8).max(64),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const operation = await performResetPassword({
      userId: user.id,
      instanceId: id,
      username: payload.username,
      password: payload.password,
    });
    await recordAudit({
      userId: user.id,
      action: "vps.reset_password",
      resourceType: "instance",
      resourceId: id,
      metadata: { username: payload.username },
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
