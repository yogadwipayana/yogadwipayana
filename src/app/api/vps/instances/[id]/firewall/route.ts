import { z } from "zod";

import { requireUser } from "@/lib/server/auth-session";
import { fail, ok } from "@/lib/server/api-response";
import {
  addFirewallRule,
  listFirewallRules,
  removeFirewallRuleByDefinition,
} from "@/lib/server/dashboard-service";

export const runtime = "nodejs";

const schema = z.object({
  protocol: z.enum(["TCP", "UDP", "ICMP", "ALL"]),
  port: z.string().min(1),
  cidrBlock: z.string().min(1),
  action: z.enum(["ACCEPT", "DROP"]),
  description: z.string().max(120).optional(),
});

const deleteSchema = z.object({ rule: schema });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const rules = await listFirewallRules(user.id, id);
    return ok({ rules });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const operation = await addFirewallRule({
      userId: user.id,
      instanceId: id,
      protocol: payload.protocol,
      port: payload.port,
      cidrBlock: payload.cidrBlock,
      action: payload.action,
      description: payload.description,
    });
    return ok({ operation }, 201);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const payload = deleteSchema.parse(await request.json());
    const operation = await removeFirewallRuleByDefinition({
      userId: user.id,
      instanceId: id,
      protocol: payload.rule.protocol,
      port: payload.rule.port,
      cidrBlock: payload.rule.cidrBlock,
      action: payload.rule.action,
      description: payload.rule.description,
    });
    return ok({ operation });
  } catch (err) {
    return fail(err);
  }
}
