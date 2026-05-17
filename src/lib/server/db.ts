import { Pool, type QueryResultRow } from "pg";

let db: Pool | null = null;

/**
 * Returns a singleton pg Pool for direct Postgres access against Supabase.
 *
 * Connection string should be the Supabase pooler URL (port 6543) so that
 * many short-lived serverless workers can share a small server-side pool.
 * Direct connection (port 5432) is fine for local dev / EC2.
 */
export function getDb() {
  if (db) return db;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  db = new Pool({
    connectionString,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
  return db;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  return getDb().query<T>(text, params);
}
