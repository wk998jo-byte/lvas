/**
 * Shared READ-ONLY inspection. The CLI opens REPEATABLE READ READ ONLY.
 * No DDL, DML, schema migration, or dry-run inserts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { APPROVAL } from "./fleet-006-approval.mjs";
import { fingerprint, vehicleFingerprint, exactPgTypes } from "./fleet-006-integrity.mjs";

export function validatePayload(payload) {
  assert.ok(Array.isArray(payload));
  assert.equal(payload.length, APPROVAL.approvedCount, "Exactly 417 approved records required");
  const fields = ["door_number", "plate_number", "make", "model", "year", "notes", "is_active"].sort();
  const doors = new Set(), plates = new Set();
  for (const row of payload) {
    assert.deepEqual(Object.keys(row).sort(), fields, "Only approved normalized fields allowed");
    assert.match(row.door_number, /^006-\d{2}-\d{3,}$/);
    assert.ok(!doors.has(row.door_number), "Duplicate payload Door");
    doors.add(row.door_number);
    assert.equal(row.is_active, true, "All 417 must be active");
    for (const key of ["make", "model"]) {
      assert.ok(typeof row[key] === "string" && row[key].trim() && row[key].length <= 80);
    }
    assert.ok(row.year === null || Number.isInteger(row.year) && row.year >= 1980 && row.year <= 2100);
    assert.ok(typeof row.notes === "string" && row.notes.length > 0);
    if (row.plate_number !== null) {
      assert.ok(typeof row.plate_number === "string" && row.plate_number.trim() &&
        row.plate_number.length <= 32 && !/^006-/i.test(row.plate_number));
      assert.ok(!plates.has(row.plate_number), "Duplicate payload plate");
      plates.add(row.plate_number);
    }
  }
  const sorted = [...payload].sort((a, b) => a.door_number.localeCompare(b.door_number));
  assert.equal(fingerprint(sorted), APPROVAL.payloadSha256, "Payload differs from audited approval");
  return sorted;
}

export async function inspectFleet(client, payload, { allowVerifiedRerun = false } = {}) {
  const rows = validatePayload(payload);
  const columns = (await client.query(`
    select column_name,is_nullable,data_type from information_schema.columns
    where table_schema='public' and table_name='vehicles'
  `)).rows;
  for (const name of ["door_number", "plate_number"]) {
    assert.ok(columns.some(c => c.column_name === name && c.data_type === "text"), `${name} text column missing`);
  }
  const indexes = (await client.query(`
    select i.indisunique,i.indisvalid,i.indisready,i.indimmediate,i.indnullsnotdistinct,
      pg_get_expr(i.indpred,i.indrelid) predicate,
      array(select a.attname::text from unnest(i.indkey) with ordinality k(attnum,ord)
        join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum
        where k.ord<=i.indnkeyatts order by k.ord) columns
    from pg_index i where i.indrelid='public.vehicles'::regclass
  `)).rows;
  const unique = name => indexes.some(i => i.indisunique && i.indisvalid && i.indisready &&
    i.indimmediate && !i.indnullsnotdistinct && i.columns.length === 1 && i.columns[0] === name &&
    (i.predicate === null || name === "door_number" &&
      i.predicate.replace(/[()]/g, "").trim().toUpperCase() === "DOOR_NUMBER IS NOT NULL"));
  assert.ok(unique("door_number"), "Door uniqueness missing/unsafe");
  assert.ok(unique("plate_number"), "Plate uniqueness/multiple NULL guarantee missing/unsafe");
  // Insert triggers/rules could mutate unrelated records: refuse them.
  const sideEffects = (await client.query(`
    select (select count(*) from pg_trigger where tgrelid='public.vehicles'::regclass
      and not tgisinternal and tgenabled<>'D' and (tgtype::int & 4)<>0)
      + (select count(*) from pg_rewrite where ev_class='public.vehicles'::regclass
      and rulename<>'_RETURN') as n
  `)).rows[0];
  assert.equal(Number(sideEffects.n), 0, "Unexpected vehicle INSERT trigger/rule");
  const vehicles = (await client.query("select * from public.vehicles order by id")).rows;
  const doors = new Set(rows.map(r => r.door_number));
  const baseline = vehicles.filter(v => !doors.has(v.door_number));
  assert.equal(baseline.length, APPROVAL.baselineCount, "Unexpected baseline count; STOP");
  assert.equal(vehicleFingerprint(baseline), APPROVAL.baselineVehiclesSha256,
    "Existing 326 vehicle UUIDs/fields changed; STOP");
  const existing = vehicles.filter(v => doors.has(v.door_number));
  assert.ok(existing.length === 0 || allowVerifiedRerun && existing.length === 417,
    "Unexpected READY Doors already exist; STOP");
  if (existing.length) {
    for (const row of rows) {
      const actual = existing.find(v => v.door_number === row.door_number);
      for (const key of Object.keys(row)) assert.equal(actual[key], row[key], `Rerun row mismatch: ${key}`);
      assert.equal(actual.created_by, null);
      assert.equal(actual.color, null);
    }
  }
  const conflicts = (await client.query(`
    select count(*)::int n from json_to_recordset($1::json)
      as p(door_number text,plate_number text)
      join public.vehicles v on v.plate_number=p.plate_number
      where v.door_number is distinct from p.door_number
  `, [JSON.stringify(rows)])).rows[0].n;
  assert.equal(conflicts, 0, "Unexpected READY plate conflicts; STOP");
  const total006 = vehicles.filter(v => v.door_number?.startsWith("006-")).length;
  assert.equal(vehicles.length, existing.length ? 743 : 326);
  assert.equal(total006, existing.length ? 742 : 325);
  return {
    currentTotal: vehicles.length, current006: total006, doorColumn: true,
    plateNullable: columns.find(c => c.column_name === "plate_number").is_nullable === "YES",
    doorUnique: true, plateUnique: true, unexpectedReadyConflicts: 0,
    verifiedRerun: existing.length === 417,
  };
}

export async function preflight(client, payload) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const result = await inspectFleet(client, payload);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payload = JSON.parse(readFileSync(process.argv[2], "utf8"));
  validatePayload(payload);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, types: exactPgTypes });
  try {
    await client.connect();
    console.log(JSON.stringify(await preflight(client, payload)));
  } catch (error) {
    console.error(`Preflight STOP: ${error.code ?? "validation"} — ${error.message}`);
    process.exitCode = 1;
  } finally { await client.end(); }
}
