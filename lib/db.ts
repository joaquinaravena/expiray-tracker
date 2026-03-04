import { neon } from "@neondatabase/serverless";

/**
 * Neon serverless SQL client. Use for all DB access.
 *
 * Env: set DATABASE_URL (pooled) in .env.local and in Vercel project settings.
 * For Vercel: Project → Settings → Environment Variables → add DATABASE_URL.
 * Optionally add DATABASE_URL_UNPOOLED if you need transactions later.
 */
function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required for database access");
  }
  return neon(url);
}

export const sql = getSql();

/**
 * Returns the first row from a query result, or null if empty.
 * Use when you expect at most one row: const row = queryOne(await sql`SELECT ...`)
 */
export function queryOne<T>(rows: T[]): T | null {
  return rows.length > 0 ? rows[0]! : null;
}
