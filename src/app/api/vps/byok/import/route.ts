import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { ApiError, fail, ok } from "@/lib/server/api-response";
import { upsertInstance } from "@/lib/server/dashboard-service";
import {
  describeInstances,
  normalizeInstance,
} from "@/lib/server/tencent/service";

export const runtime = "nodejs";

const payloadSchema = z.object({
  externalInstanceId: z.string().min(1),
  secretId: z.string().min(1),
  secretKey: z.string().min(1),
  region: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = payloadSchema.parse(await request.json());
    const creds = {
      secretId: payload.secretId,
      secretKey: payload.secretKey,
      region: payload.region,
    };
    const instances = await describeInstances(creds, {
      InstanceIds: [payload.externalInstanceId],
      Offset: 0,
      Limit: 1,
    });
    const instance = instances[0];
    if (!instance) {
      throw new ApiError(404, "INSTANCE_NOT_FOUND", "Provider instance not found");
    }

    const saved = await upsertInstance(
      user.id,
      "byok_import",
      normalizeInstance(instance, creds.region),
      { secretId: payload.secretId, secretKey: payload.secretKey },
    );
    return ok({ instance: saved });
  } catch (err) {
    return fail(err);
  }
}
