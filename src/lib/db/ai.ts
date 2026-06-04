// Read-only Prisma client for the AI Router database (ai.yogathedev.com).
//
// Schema is owned by the `9router` project. This app never writes to it —
// the $extends guard below throws on any mutation operation, so a misuse
// surfaces immediately in dev rather than silently corrupting upstream data.
// Pair this with a Postgres role that only has SELECT grants for defence
// in depth.
//
// Singleton pattern: in dev Next.js hot-reloads modules, which would leak a
// new PrismaClient on every reload and exhaust the connection pool. We pin
// it to globalThis so the same instance survives reloads.

import { PrismaClient } from "@/generated/ai-client";

const FORBIDDEN_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "executeRawUnsafe",
]);

function createReadOnlyClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          if (FORBIDDEN_OPERATIONS.has(operation)) {
            throw new Error(
              `[aiDb] Write operation '${operation}' on '${model}' is forbidden — this database is read-only.`,
            );
          }
          return query(args);
        },
      },
    },
  });
}

type ReadOnlyAiClient = ReturnType<typeof createReadOnlyClient>;

const globalForAiDb = globalThis as unknown as {
  aiDb?: ReadOnlyAiClient;
};

export const aiDb: ReadOnlyAiClient = globalForAiDb.aiDb ?? createReadOnlyClient();

if (process.env.NODE_ENV !== "production") {
  globalForAiDb.aiDb = aiDb;
}
