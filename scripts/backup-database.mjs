/**
 * Export public LVAS tables via DATABASE_URL into a timestamped folder.
 * Does not print row contents. Usage: node scripts/backup-database.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const TABLES = ["profiles", "employees", "vehicles", "authorizations", "notifications"];

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const workDir = join(homedir(), "Downloads", `lvas-backup-${stamp}`);
mkdirSync(workDir, { recursive: true });

try {
  const summary = { created_at: new Date().toISOString(), tables: {} };
  for (const table of TABLES) {
    const { rows } = await client.query(`select * from ${table}`);
    writeFileSync(join(workDir, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
    summary.tables[table] = rows.length;
    console.log(`Exported ${table}: ${rows.length} rows`);
  }
  writeFileSync(join(workDir, "manifest.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("Backup folder:", workDir);
} finally {
  await client.end();
}
