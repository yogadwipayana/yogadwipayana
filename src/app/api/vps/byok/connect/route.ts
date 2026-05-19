import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import {
  describeInstances,
  normalizeInstance,
} from "@/lib/server/tencent/service";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const payloadSchema = z.object({
  secretId: z.string().min(1),
  secretKey: z.string().min(1),
  region: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const ip = request.headers.get("x-forwarded-for") || undefined;
    await checkRateLimit(
      ratelimits.connectCloud,
      getRateLimitIdentifier(user.id, ip),
      "cloud account connection",
    );
    const parsed = payloadSchema.parse(await request.json());

    const creds = {
      secretId: parsed.secretId,
      secretKey: parsed.secretKey,
      region: parsed.region,
    };
    const instances = await describeInstances(creds, { Offset: 0, Limit: 20 });

    return ok({
      connected: true,
      count: instances.length,
      instances: instances.map((item) => normalizeInstance(item, parsed.region)),
    });
  } catch (err) {
    return fail(err);
  }
}
