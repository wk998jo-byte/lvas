import { Pool, types } from "pg";

// Keep DATE / TIME / timestamps as strings so existing UI code is unchanged.
types.setTypeParser(1082, (value) => value); // date
types.setTypeParser(1083, (value) => value); // time
types.setTypeParser(1114, (value) => value); // timestamp
types.setTypeParser(1184, (value) => value); // timestamptz

declare global {
  var __lvasPgPool: Pool | undefined;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is missing. Set it in Replit Secrets or .env.local.");
  }
  return url;
}

export function getPool(): Pool {
  if (globalThis.__lvasPgPool) {
    return globalThis.__lvasPgPool;
  }

  const pool = new Pool({
    connectionString: databaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 12_000,
  });

  globalThis.__lvasPgPool = pool;
  return pool;
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const result = await getPool().query(text, params);
  return result.rowCount ?? 0;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23505"
  );
}

export function isOverlapViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = (error as { code: string; message?: string }).code;
  const message = (error as { message?: string }).message ?? "";
  return (
    code === "23P01" ||
    /overlap|active authorization/i.test(message)
  );
}

export function isCheckViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "23514"
  );
}

export function pgErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return error instanceof Error ? error.message : "Database error";
}
