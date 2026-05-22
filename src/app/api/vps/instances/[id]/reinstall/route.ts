import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { recordAudit } from "@/lib/server/audit";
import { performReinstall } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const schema = z.object({
  blueprintId: z.string().min(1),
  password: z.string().min(8).max(64).optional(),
  keyId: z.string().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const operation = await performReinstall({
      userId: user.id,
      instanceId: id,
      blueprintId: payload.blueprintId,
      password: payload.password,
      keyId: payload.keyId,
    });
    await recordAudit({
      userId: user.id,
      action: "vps.reinstall",
      resourceType: "instance",
      resourceId: id,
      metadata: {
        blueprint_id: payload.blueprintId,
        used_key: Boolean(payload.keyId),
      },
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
