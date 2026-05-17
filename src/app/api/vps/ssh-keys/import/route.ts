import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { createImportedSshKey } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const schema = z.object({
  keyName: z.string().min(1).max(128),
  publicKey: z.string().min(32),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = schema.parse(await request.json());
    const key = await createImportedSshKey(user.id, payload.keyName, payload.publicKey);
    return ok({ key }, 201);
  } catch (err) {
    return fail(err);
  }
}
