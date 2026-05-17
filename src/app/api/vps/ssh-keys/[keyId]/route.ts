import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import { deleteSshKey, replaceImportedSshKey } from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const editSchema = z.object({
  keyName: z.string().min(1).max(128),
  publicKey: z.string().min(32),
});

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ keyId: string }> },
) {
  try {
    const user = await requireUser();
    const { keyId } = await context.params;
    const result = await deleteSshKey(user.id, keyId);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ keyId: string }> },
) {
  try {
    const user = await requireUser();
    const { keyId } = await context.params;
    const payload = editSchema.parse(await request.json());
    const result = await replaceImportedSshKey(
      user.id,
      keyId,
      payload.keyName,
      payload.publicKey,
    );
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
