/**
 * Upsert scripts/employees.json into employees using DATABASE_URL.
 * Usage: node scripts/import-employees.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
loadEnvFiles(root);

const employees = JSON.parse(await readFile(path.join(here, "employees.json"), "utf8"));
console.log(`Loaded ${employees.length} employees`);

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();
try {
  await client.query("begin");
  for (const row of employees) {
    await client.query(
      `
        insert into employees (badge, full_name, national_id, mobile, department, position, role)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (badge) do update set
          full_name = excluded.full_name,
          national_id = excluded.national_id,
          mobile = excluded.mobile,
          department = excluded.department,
          position = excluded.position,
          role = excluded.role
      `,
      [
        row.badge,
        row.full_name,
        row.national_id ?? null,
        row.mobile ?? null,
        row.department ?? null,
        row.position ?? null,
        row.role,
      ],
    );
  }
  await client.query("commit");
  const { rows } = await client.query(`select count(*)::int as count from employees`);
  console.log(`Done. employees table now holds ${rows[0].count} rows.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
