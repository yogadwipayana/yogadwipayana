import { z } from "zod";

import { fail, ok } from "@/lib/server/api-response";
import { requireUser } from "@/lib/server/auth-session";
import {
  deleteSshCredential,
  getSshCredential,
  upsertSshCredential,
} from "@/lib/server/ssh-credential-service";

export const runtime = "nodejs";

const putSchema = z
  .object({
    username: z.string().min(1).max(50),
    port: z.number().int().min(1).max(65535),
    authMethod: z.enum(["password", "key"]),
    password: z.string().min(1).optional(),
    privateKey: z.string().min(1).optional(),
    passphrase: z.string().optional(),
    hostOverride: z.string().optional(),
  })
  .refine(
    (v) => (v.authMethod === "password" ? !!v.password : !!v.privateKey),
    { message: "Provide password for password auth or privateKey for key auth" },
  );

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const credential = await getSshCredential(user.id, id, "safe");
    return ok({ credential });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = putSchema.parse(await request.json());
    const credential = await upsertSshCredential({
      userId: user.id,
      instanceId: id,
      username: payload.username,
      port: payload.port,
      authMethod: payload.authMethod,
      password: payload.password,
      privateKey: payload.privateKey,
      passphrase: payload.passphrase,
      hostOverride: payload.hostOverride,
    });
    return ok({ credential });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteSshCredential(user.id, id);
    return ok({ deleted: true });
  } catch (err) {
    return fail(err);
  }
}
