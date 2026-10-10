/**
 * Import PREPARATION / disposable verification only. No env files are loaded.
 * CLI refuses every database except the dedicated localhost fixture.
 * node scripts/import-fleet-006.mjs ready.json activation-plan.json [--apply]
 * Default is dry-run. An explicitly approved availability boolean is required
 * per new Door Number; source status is retained verbatim, never guessed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

export function validateReady(records) {
  assert.ok(Array.isArray(records), "READY data must be an array");
  const seen = new Set();
  return records.map((row) => {
    assert.equal(row.classification, "MISSING — READY TO IMPORT", "Only READY records are permitted");
    assert.match(row.door_number, /^006-\d{2}-\d{3,}$/, "Valid formatted Door Number required");
    assert.ok(row.door_number.length <= 64, "Door Number too long");
    assert.ok(!seen.has(row.door_number), `Duplicate READY Door Number: ${row.door_number}`);
    seen.add(row.door_number);
    assert.ok(Array.isArray(row.conflicts) && row.conflicts.length === 0, "Unresolved conflict cannot be imported");
    for (const key of ["make", "model"]) {
      assert.ok(typeof row[key] === "string" && row[key].trim() && row[key].length <= 80, `Trustworthy ${key} required`);
    }
    assert.ok(row.plate_number === null || (
      typeof row.plate_number === "string" && row.plate_number.trim() &&
      row.plate_number.length <= 32 && !/^006-/.test(row.plate_number)
    ), "Plate must be actual supplied registration or null, never a Door Number");
    assert.ok(row.year === null || (Number.isInteger(row.year) && row.year >= 1980 && row.year <= 2100), "Invalid year");
    assert.ok(typeof row.status === "string" && row.status.length > 0, "Explicit source status or UNKNOWN required");
    assert.ok(Array.isArray(row.sources) && row.sources.length > 0, "Source references required");
    return row;
  }).sort((a, b) => a.door_number.localeCompare(b.door_number));
}

export function assertDisposable(url) {
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "127.0.0.1", "Disposable localhost only; Production unsupported");
  assert.equal(parsed.port, "15439", "Dedicated disposable port required");
  assert.equal(parsed.pathname, "/heliumdb", "Dedicated disposable database required");
}

export async function importReady(client, records, activationPlan, { apply = false } = {}) {
  const target = client.connectionParameters;
  assert.ok(target, "A dedicated disposable pg.Client is required");
  assertDisposable(`postgresql://${target.host}:${target.port}/${target.database}`);
  const rows = validateReady(records);
  const identity = (await client.query("select current_database() name,current_user role")).rows[0];
  assert.equal(identity.name, "heliumdb");
  assert.equal(identity.role, "postgres");
  await client.query("begin isolation level serializable");
  try {
    // Coordinate reruns; other unexpected uniqueness conflicts still abort all.
    await client.query("select pg_advisory_xact_lock(606006,606006)");
    const result = { ready: rows.length, inserted: 0, skipped: 0, dryRun: !apply };
    for (const row of rows) {
      const existing = (await client.query("select id from vehicles where door_number=$1", [row.door_number])).rows[0];
      if (existing) {
        result.skipped++;
        continue; // NEVER UPDATE; keep the existing UUID and all attributes.
      }
      assert.equal(typeof activationPlan?.[row.door_number], "boolean",
        `Explicit approved availability required for ${row.door_number}; source status ${row.status}`);
      const notes = [
        `Asset No: ${row.door_number}`, `Status: ${row.status}`,
        row.category?.length ? `Type: ${row.category.join(", ")}` : null,
        row.chassis ? `Chassis: ${row.chassis}` : null,
        `Source: ${row.sources.map(s => `${s.source_sheet}!${s.source_row}`).join("; ")}`,
      ].filter(Boolean).join(" | ");
      // Even dry-run executes the exact insert inside a transaction then rolls
      // it back, proving all constraints rather than silently ignoring them.
      const inserted = await client.query(`
        insert into vehicles(door_number,plate_number,make,model,year,is_active,notes)
        values($1,$2,$3,$4,$5,$6,$7)
        on conflict(door_number) where door_number is not null do nothing
        returning id
      `, [row.door_number, row.plate_number, row.make, row.model, row.year,
        activationPlan[row.door_number], notes]);
      if (inserted.rowCount) result.inserted++;
      else result.skipped++;
    }
    await client.query(apply ? "commit" : "rollback");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error; // Plate collisions / unexpected errors are never ignored.
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assertDisposable(process.env.DATABASE_URL ?? "");
  const records = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const plan = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log(JSON.stringify(await importReady(client, records, plan, {
      apply: process.argv.includes("--apply"),
    })));
  } finally {
    await client.end();
  }
}
