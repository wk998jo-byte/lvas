/**
 * Upsert scripts/light-vehicles.json into vehicles using DATABASE_URL.
 * Usage: node scripts/import-vehicles.mjs
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
loadEnvFiles(root);

const vehicles = JSON.parse(await readFile(path.join(here, "light-vehicles.json"), "utf8"));
console.log(`Loaded ${vehicles.length} vehicles`);

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();
try {
  await client.query("begin");
  for (const row of vehicles) {
    await client.query(
      `
        insert into vehicles (plate_number, make, model, year, is_active, notes)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (plate_number) do update set
          make = excluded.make,
          model = excluded.model,
          year = excluded.year,
          is_active = excluded.is_active,
          notes = excluded.notes
      `,
      [
        row.plate_number,
        row.make,
        row.model,
        row.year ?? null,
        row.is_active ?? true,
        row.notes ?? null,
      ],
    );
  }
  await client.query("commit");
  const { rows } = await client.query(`select count(*)::int as count from vehicles`);
  console.log(`Done. vehicles table now holds ${rows[0].count} rows.`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
