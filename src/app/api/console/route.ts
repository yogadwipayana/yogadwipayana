import { aiDb } from "@/lib/db/ai";
import { ApiError, fail, ok } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  ratelimits,
} from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const PAGE_SIZE = 10;

export type TempKeyStatus =
  | "active"
  | "unused"
  | "expired"
  | "depleted"
  | "disabled";

function resolveStatus(row: {
  isActive: number | null;
  firstUsedAt: string | null;
  expiresAt: string | null;
  spentUsd: number;
  budgetUsd: number;
}): TempKeyStatus {
  if (row.isActive !== 1) return "disabled";
  if (row.expiresAt && Date.now() >= new Date(row.expiresAt).getTime()) {
    return "expired";
  }
  if (row.spentUsd >= row.budgetUsd) return "depleted";
  if (!row.firstUsedAt) return "unused";
  return "active";
}

function maskKey(raw: string): string {
  return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
}

/** Extract cached-token count from the raw `tokens` JSON column, if present. */
function parseCachedTokens(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "cached_tokens" in parsed) {
      const n = (parsed as { cached_tokens?: unknown }).cached_tokens;
      return typeof n === "number" ? n : 0;
    }
  } catch {
    // Malformed JSON — treat as no cache info.
  }
  return 0;
}

export async function POST(request: Request) {
  try {
    await checkRateLimit(
      ratelimits.console,
      getClientIp(request.headers) ?? "unknown",
      "console",
    );

    const body: unknown = await request.json().catch(() => null);
    const key =
      body && typeof body === "object" && "key" in body && typeof body.key === "string"
        ? body.key.trim()
        : "";
    const rawPage =
      body && typeof body === "object" && "page" in body ? body.page : 1;
    const page =
      typeof rawPage === "number" && Number.isInteger(rawPage) && rawPage > 0
        ? rawPage
        : 1;

    if (!key) {
      throw new ApiError(400, "MISSING_KEY", "API key is required");
    }

    const keyRow = await aiDb.tempApiKeys.findUnique({ where: { key } });
    if (!keyRow) {
      throw new ApiError(401, "INVALID_KEY", "Invalid API key");
    }

    const where = { tempKeyId: keyRow.id };

    const [totals, total, models, logs] = await Promise.all([
      aiDb.tempUsageHistory.aggregate({
        _sum: { promptTokens: true, completionTokens: true, cost: true },
        where,
      }),
      aiDb.tempUsageHistory.count({ where }),
      aiDb.tempUsageHistory.groupBy({
        by: ["model"],
        where,
        _count: { _all: true },
        _sum: { promptTokens: true, completionTokens: true, cost: true },
        orderBy: { _sum: { cost: "desc" } },
        take: 5,
      }),
      aiDb.tempUsageHistory.findMany({
        where,
        orderBy: { id: "desc" },
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    ]);

    return ok({
      key: {
        name: keyRow.name,
        maskedKey: maskKey(keyRow.key),
        note: keyRow.note,
        status: resolveStatus(keyRow),
        budgetUsd: keyRow.budgetUsd,
        spentUsd: keyRow.spentUsd,
        remainingUsd: Math.max(0, keyRow.budgetUsd - keyRow.spentUsd),
        requestCount: keyRow.requestCount,
        durationSeconds: keyRow.durationSeconds,
        createdAt: keyRow.createdAt,
        firstUsedAt: keyRow.firstUsedAt,
        expiresAt: keyRow.expiresAt,
      },
      totals: {
        requests: total,
        promptTokens: totals._sum.promptTokens ?? 0,
        completionTokens: totals._sum.completionTokens ?? 0,
        cost: totals._sum.cost ?? 0,
      },
      models: models.map((m) => ({
        model: m.model ?? "unknown",
        requests: m._count._all,
        promptTokens: m._sum.promptTokens ?? 0,
        completionTokens: m._sum.completionTokens ?? 0,
        cost: m._sum.cost ?? 0,
      })),
      logs: logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        provider: log.provider,
        model: log.model,
        endpoint: log.endpoint,
        promptTokens: log.promptTokens ?? 0,
        completionTokens: log.completionTokens ?? 0,
        cachedTokens: parseCachedTokens(log.tokens),
        cost: log.cost ?? 0,
        status: log.status,
      })),
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    });
  } catch (err) {
    return fail(err);
  }
}
