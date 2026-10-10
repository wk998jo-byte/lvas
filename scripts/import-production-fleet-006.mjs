/**
 * Future, manually invoked, approved-data DML runner ONLY. Never migrates schema.
 * Default: READ-ONLY preflight. To write requires --apply plus exact confirmation
 * and explicit --target=hostname:port/database matching the pg.Client target.
 * This task does NOT authorize Production execution.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { inspectFleet, preflight, validatePayload } from "./fleet-006-preflight.mjs";
import { vehicleFingerprint, exactPgTypes } from "./fleet-006-integrity.mjs";

export const CONFIRMATION = "IMPORT-417-ACTIVE-006";

export async function importProductionReady(client, payload, { confirmation, expectedTarget } = {}) {
  assert.equal(confirmation, CONFIRMATION, "Explicit future execution confirmation required");
  const target = client.connectionParameters;
  assert.ok(target && expectedTarget, "Explicit target required");
  assert.equal(`${target.host}:${target.port}/${target.database}`, expectedTarget, "Wrong database target");
  const probe = (await client.query("select '2026-10-10 00:00:00.000001+00'::timestamptz as value")).rows[0].value;
  assert.ok(typeof probe === "string" && probe.includes(".000001"), "Exact timestamp parser required");
  const rows = validatePayload(payload);
  await client.query("begin isolation level serializable");
  try {
    await client.query("set local lock_timeout='5s'");
    await client.query("set local statement_timeout='30s'");
    await client.query("select pg_advisory_xact_lock(606006,606006)");
    // Briefly freeze relevant writes while verifying and inserting. No DML on
    // authorizations/profiles/assignments; FK checks can still read vehicles.
    await client.query("lock table public.vehicles in share row exclusive mode");
    await client.query("lock table public.authorizations,public.profiles,public.logistics_approver_locations in share mode");
    const state = await inspectFleet(client, rows, { allowVerifiedRerun: true });
    assert.ok(state.plateNullable, "Supported nullable-plate schema step not completed; STOP");
    const originals = (await client.query("select * from public.vehicles order by id")).rows;
    const links = (await client.query("select id,vehicle_id from public.authorizations order by id")).rows;
    const profiles = (await client.query("select * from public.profiles order by id")).rows;
    const assignments = (await client.query("select * from public.logistics_approver_locations order by profile_id,location")).rows;
    let inserted = 0;
    if (!state.verifiedRerun) {
      for (const row of rows) {
        // No ON CONFLICT DO NOTHING: unexpected concurrent conflicts must abort.
        const result = await client.query(`
          insert into public.vehicles(door_number,plate_number,make,model,year,notes,is_active)
          values($1,$2,$3,$4,$5,$6,true) returning id
        `, [row.door_number, row.plate_number, row.make, row.model, row.year, row.notes]);
        assert.equal(result.rowCount, 1);
        inserted++;
      }
    }
    const final = await inspectFleet(client, rows, { allowVerifiedRerun: true });
    assert.equal(final.currentTotal, 743);
    assert.equal(final.current006, 742);
    const preserved = (await client.query("select * from public.vehicles where id=any($1::uuid[]) order by id",
      [originals.map(v => v.id)])).rows;
    assert.equal(vehicleFingerprint(preserved), vehicleFingerprint(originals), "Existing vehicle changed");
    assert.deepEqual((await client.query("select id,vehicle_id from public.authorizations order by id")).rows, links);
    assert.deepEqual((await client.query("select * from public.profiles order by id")).rows, profiles);
    assert.deepEqual((await client.query("select * from public.logistics_approver_locations order by profile_id,location")).rows, assignments);
    await client.query("commit");
    return { inserted, skipped: 417 - inserted, total: 743, total006: 742, newActive: 417 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validatePayload(payload);
  const args = process.argv.slice(3);
  assert.ok(args.every(a => a === "--apply" || /^--(?:confirm|target)=.+$/.test(a)), "Unknown option");
  const apply = args.includes("--apply");
  const confirmation = args.find(a => a.startsWith("--confirm="))?.slice(10);
  const expectedTarget = args.find(a => a.startsWith("--target="))?.slice(9);
  if (apply) {
    assert.equal(confirmation, CONFIRMATION);
    assert.ok(expectedTarget, "Explicit target required");
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, types: exactPgTypes });
  try {
    await client.connect();
    console.log(JSON.stringify(apply
      ? await importProductionReady(client, payload, { confirmation, expectedTarget })
      : await preflight(client, payload)));
  } catch (error) {
    // Assertions may contain private profile/vehicle rows. Never dump them.
    console.error(`Import STOP: ${error.code ?? "validation"} — no import committed; inspect privately`);
    process.exitCode = 1;
  } finally { await client.end(); }
}
