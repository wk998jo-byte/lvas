/**
 * Validate imported PostgreSQL data against a JSON backup.
 * Prints counts and integrity checks only — no PII.
 *
 * Usage: node scripts/validate-migration.mjs "path/to/backup-folder"
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scripts/validate-migration.mjs <backup-folder>");
  process.exit(1);
}

function loadCount(name) {
  const file = path.join(backupDir, `${name}.json`);
  if (!existsSync(file)) throw new Error(`Missing ${name}.json`);
  const rows = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(rows) ? rows.length : -1;
}

function loadRows(name) {
  return JSON.parse(readFileSync(path.join(backupDir, `${name}.json`), "utf8"));
}

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();

try {
  const tables = ["profiles", "employees", "vehicles", "authorizations", "notifications"];
  let failed = false;

  console.log("Count comparison:");
  for (const table of tables) {
    const source = loadCount(table);
    const { rows } = await client.query(`select count(*)::int as count from ${table}`);
    const dest = rows[0].count;
    const ok = source === dest;
    if (!ok) failed = true;
    console.log(`  ${table}: source=${source} dest=${dest} ${ok ? "OK" : "MISMATCH"}`);
  }

  const { rows: missingVehicles } = await client.query(`
    select count(*)::int as count
    from authorizations a
    left join vehicles v on v.id = a.vehicle_id
    where v.id is null
  `);
  const { rows: missingEmployees } = await client.query(`
    select count(*)::int as count
    from authorizations a
    where a.employee_id is not null
      and not exists (select 1 from employees e where e.id = a.employee_id)
  `);
  const { rows: missingRequesters } = await client.query(`
    select count(*)::int as count
    from authorizations a
    where a.requester_id is not null
      and not exists (select 1 from profiles p where p.id = a.requester_id)
  `);
  const { rows: missingApprovers } = await client.query(`
    select count(*)::int as count
    from authorizations a
    where a.approver_id is not null
      and not exists (select 1 from profiles p where p.id = a.approver_id)
  `);
  const { rows: plateDupes } = await client.query(`
    select count(*)::int as count from (
      select plate_number from vehicles group by plate_number having count(*) > 1
    ) d
  `);
  const { rows: badgeDupes } = await client.query(`
    select count(*)::int as count from (
      select badge from employees group by badge having count(*) > 1
    ) d
  `);

  const sourceAuths = loadRows("authorizations");
  const { rows: tokenRows } = await client.query(
    `select id::text as id, public_token::text as public_token from authorizations`,
  );
  const destTokens = new Map(tokenRows.map((row) => [row.id, row.public_token]));
  let tokenMismatches = 0;
  for (const row of sourceAuths) {
    if (destTokens.get(row.id) !== row.public_token) tokenMismatches += 1;
  }

  const checks = [
    ["missing authorization vehicles", missingVehicles[0].count],
    ["missing authorization employees", missingEmployees[0].count],
    ["missing authorization requesters", missingRequesters[0].count],
    ["missing authorization approvers", missingApprovers[0].count],
    ["duplicate plates", plateDupes[0].count],
    ["duplicate badges", badgeDupes[0].count],
    ["public_token mismatches", tokenMismatches],
  ];

  console.log("Integrity:");
  for (const [label, count] of checks) {
    if (count !== 0) failed = true;
    console.log(`  ${label}: ${count} ${count === 0 ? "OK" : "FAIL"}`);
  }

  if (failed) {
    console.error("Validation FAILED");
    process.exitCode = 1;
  } else {
    console.log("Validation PASSED");
  }
} finally {
  await client.end();
}
