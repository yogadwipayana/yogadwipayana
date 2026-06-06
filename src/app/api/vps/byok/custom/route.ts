import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import {
  createCustomInstance,
  removeUserInstance,
} from "@/lib/server/dashboard-service";
import { upsertSshCredential } from "@/lib/server/ssh-credential-service";

export const runtime = "nodejs";

const payloadSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    host: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535),
    username: z.string().trim().min(1).max(50),
    authMethod: z.enum(["password", "key"]),
    password: z.string().min(1).optional(),
    privateKey: z.string().min(1).optional(),
    passphrase: z.string().optional(),
  })
  .refine(
    (v) => (v.authMethod === "password" ? !!v.password : !!v.privateKey),
    { message: "Provide password for password auth or privateKey for key auth" },
  );

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const payload = payloadSchema.parse(await request.json());

    const instance = await createCustomInstance({
      userId: user.id,
      name: payload.name,
      host: payload.host,
    });

    // Attach SSH credentials. If this fails, roll back the instance so we don't
    // leave a credential-less custom target stranded in the list.
    try {
      await upsertSshCredential({
        userId: user.id,
        instanceId: instance.id,
        username: payload.username,
        port: payload.port,
        authMethod: payload.authMethod,
        password: payload.password,
        privateKey: payload.privateKey,
        passphrase: payload.passphrase,
        hostOverride: payload.host,
      });
    } catch (err) {
      await removeUserInstance(user.id, instance.id).catch(() => {});
      throw err;
    }

    return ok({ instance });
  } catch (err) {
    return fail(err);
  }
}
