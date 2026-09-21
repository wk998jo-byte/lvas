/**
 * Apply db/schema.sql to DATABASE_URL.
 * Usage: node scripts/init-db.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const sql = readFileSync(path.join(root, "db", "schema.sql"), "utf8");
const client = new pg.Client({ connectionString: requireDatabaseUrl() });

await client.connect();
try {
  await client.query(sql);
  console.log("Schema applied.");
} finally {
  await client.end();
}
