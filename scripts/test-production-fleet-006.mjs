/**
 * Exact future rollout against an EMPTY dedicated disposable DB only.
 * snapshot.json payload.json audit.json
 * Never loads app env files; never connects to Production.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import pg from "pg";
import ts from "typescript";
import { assertDisposable } from "./import-fleet-006.mjs";
import { fingerprint, vehicleFingerprint, exactPgTypes } from "./fleet-006-integrity.mjs";
import { preflight, inspectFleet, validatePayload } from "./fleet-006-preflight.mjs";
import { CONFIRMATION, importProductionReady } from "./import-production-fleet-006.mjs";

assertDisposable(process.env.DATABASE_URL ?? "");
const root = path.resolve(import.meta.dirname, "..");
const source = file => readFileSync(path.join(root, file), "utf8");
const read = file => JSON.parse(readFileSync(file, "utf8"));
const snapshot = read(process.argv[2]), payload = read(process.argv[3]), audit = read(process.argv[4]);
assert.ok(Array.isArray(snapshot.authorizations), "Complete fresh authorization-link snapshot required");
assert.equal(snapshot.authorizations.length, 14, "This complete fresh snapshot has 14 actual links");
assert.equal(new Set(snapshot.authorizations.map(a => a.id)).size, 14);
assert.ok(snapshot.authorizations.every(a => snapshot.vehicles.some(v => v.id === a.vehicle_id)));
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, types: exactPgTypes });
await client.connect();
const options = { confirmation: CONFIRMATION, expectedTarget: "127.0.0.1:15439/heliumdb" };
const cache = new Map(), native = createRequire(import.meta.url);
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const cjs = { exports: {} };
  cache.set(file, cjs.exports);
  function require(name) {
    if (name === "@/lib/db/pool") return {
      query: async (sql, params = []) => (await client.query(sql, params)).rows,
      queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] ?? null,
    };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(source(stem));
      const file = [stem + ".ts", stem + ".tsx", stem + "/index.ts"].find(p => existsSync(path.join(root, p)));
      assert.ok(file, name);
      return load(file);
    }
    return native(name);
  }
  vm.runInNewContext(ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module: cjs, exports: cjs.exports, require, console });
  return cjs.exports;
}

try {
  assert.equal((await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0,
    "Only an EMPTY disposable database is permitted");
  assert.equal(validatePayload(payload).length, 417);
  assert.notEqual(fingerprint({ updated_at: "2026-10-10T00:00:00.000001Z" }),
    fingerprint({ updated_at: "2026-10-10T00:00:00.000002Z" }), "Microsecond changes must be detected");
  assert.ok(payload.every(r => r.is_active === true));
  const review = audit.candidates.filter(c => c.classification === "MISSING — CONFLICT / NEEDS REVIEW");
  assert.equal(review.length, 20);
  assert.ok(review.every(c => !payload.some(r => r.door_number === c.door_number)));
  await client.query(source("db/schema.sql").replace("  plate_number text,", "  plate_number text not null,"));
  const actor = "99999999-0000-4000-8000-000000000900";
  for (const id of new Set([actor, ...snapshot.vehicles.map(v => v.created_by).filter(Boolean)])) {
    await client.query("insert into profiles(id,full_name,email,role) values($1,'Synthetic actor',$2,'admin')", [id, `${id}@example.invalid`]);
  }
  await client.query("insert into logistics_approver_locations(profile_id,location) values($1,'Jafurah')", [actor]);
  for (const row of snapshot.vehicles) {
    const keys = Object.keys(row);
    assert.ok(keys.every(k => /^[a-z_]+$/.test(k)));
    await client.query(`insert into vehicles(${keys.join(",")}) values(${keys.map((_, i) => "$" + (i + 1)).join(",")})`,
      keys.map(k => row[k]));
  }
  for (const link of snapshot.authorizations) {
    await client.query(`insert into authorizations(id,vehicle_id,requester_id,start_date,end_date,duration_label,status)
      values($1,$2,$3,'2026-10-10','2026-10-10','1 day','cancelled')`, [link.id, link.vehicle_id, actor]);
  }
  const base = (await client.query("select * from vehicles order by id")).rows;
  assert.equal(vehicleFingerprint(base), vehicleFingerprint(snapshot.vehicles));
  const beforeLinks = (await client.query("select id,vehicle_id from authorizations order by id")).rows;
  assert.deepEqual(beforeLinks, [...snapshot.authorizations].sort((a, b) => a.id.localeCompare(b.id)));
  const beforeProfiles = fingerprint((await client.query("select * from profiles order by id")).rows);
  const beforeAssignments = fingerprint((await client.query("select * from logistics_approver_locations order by profile_id,location")).rows);
  const state = await preflight(client, payload);
  assert.deepEqual(state, { currentTotal: 326, current006: 325, doorColumn: true,
    plateNullable: false, doorUnique: true, plateUnique: true, unexpectedReadyConflicts: 0, verifiedRerun: false });
  const tampered = structuredClone(payload);
  tampered[0].is_active = false;
  assert.throws(() => validatePayload(tampered));
  tampered[0] = { ...payload[0], notes: "Changed after approval" };
  assert.throws(() => validatePayload(tampered), /audited approval/);
  await assert.rejects(importProductionReady(client, payload, {}), /confirmation/);
  await assert.rejects(importProductionReady(client, payload, { ...options, expectedTarget: "wrong" }), /Wrong database/);
  await assert.rejects(importProductionReady(client, payload, options), /nullable-plate/);
  await client.query(source("db/migrations/20261009_vehicle_plate_nullable.sql"));
  assert.equal(vehicleFingerprint((await client.query("select * from vehicles order by id")).rows), vehicleFingerprint(base));
  // Independent NULL/uniqueness probes are rolled back; exact rollout stays 743.
  await client.query("begin");
  await client.query("insert into vehicles(door_number,plate_number,make,model) values('006-99-001',null,'Synthetic','Probe'),('006-99-002',null,'Synthetic','Probe')");
  await client.query("savepoint duplicate_probe");
  await assert.rejects(client.query("insert into vehicles(door_number,make,model) values('006-99-001','Synthetic','Probe')"),
    e => e.code === "23505");
  await client.query("rollback to savepoint duplicate_probe");
  await assert.rejects(client.query("insert into vehicles(plate_number,make,model) values($1,'Synthetic','Probe')", [base[0].plate_number]),
    e => e.code === "23505");
  await client.query("rollback");
  // Negative preflights: changed baseline, partial prior import, unsafe index.
  await client.query("begin");
  await client.query("update vehicles set model='Synthetic changed baseline' where id=$1", [base[0].id]);
  await assert.rejects(inspectFleet(client, payload), /changed/);
  await client.query("rollback");
  await client.query("begin");
  const p = payload[0];
  await client.query("insert into vehicles(door_number,plate_number,make,model,notes,is_active) values($1,$2,$3,$4,$5,true)",
    [p.door_number, p.plate_number, p.make, p.model, p.notes]);
  await assert.rejects(inspectFleet(client, payload), /already exist/);
  await client.query("rollback");
  await client.query("begin");
  await client.query("alter table vehicles drop constraint vehicles_plate_number_unique");
  await assert.rejects(inspectFleet(client, payload), /uniqueness/);
  await client.query("rollback");
  // Fault injection on insert 8 proves earlier inserts also roll back.
  let insertCalls = 0;
  const fault = {
    connectionParameters: client.connectionParameters,
    query: (sql, params) => {
      if (/insert into public\.vehicles/i.test(sql) && ++insertCalls === 8) {
        params = [...params]; params[1] = base[0].plate_number;
      }
      return client.query(sql, params);
    },
  };
  await assert.rejects(importProductionReady(fault, payload, options), e => e.code === "23505");
  assert.equal(insertCalls, 8);
  assert.equal(vehicleFingerprint((await client.query("select * from vehicles order by id")).rows), vehicleFingerprint(base));
  const first = await importProductionReady(client, payload, options);
  assert.deepEqual(first, { inserted: 417, skipped: 0, total: 743, total006: 742, newActive: 417 });
  const all = (await client.query("select * from vehicles order by id")).rows;
  assert.equal(all.length, 743);
  assert.equal(all.filter(v => v.door_number?.startsWith("006-")).length, 742);
  assert.equal(new Set(all.filter(v => v.door_number !== null).map(v => v.door_number)).size, 742);
  assert.ok(review.every(c => !all.some(v => v.door_number === c.door_number)));
  const originalIds = new Set(base.map(v => v.id));
  assert.equal(vehicleFingerprint(all.filter(v => originalIds.has(v.id))), vehicleFingerprint(base));
  const second = await importProductionReady(client, payload, options);
  assert.equal(second.inserted, 0);
  assert.equal(second.skipped, 417);
  assert.equal(vehicleFingerprint((await client.query("select * from vehicles order by id")).rows), vehicleFingerprint(all));
  await assert.rejects(preflight(client, payload), /already exist/);
  assert.deepEqual((await client.query("select id,vehicle_id from authorizations order by id")).rows, beforeLinks);
  assert.equal(fingerprint((await client.query("select * from profiles order by id")).rows), beforeProfiles);
  assert.equal(fingerprint((await client.query("select * from logistics_approver_locations order by profile_id,location")).rows), beforeAssignments);
  const queries = load("lib/db/queries.ts"), identity = load("lib/vehicles/identity.ts");
  const selectable = await queries.listActiveVehicles();
  for (const row of payload) {
    const selected = selectable.find(v => v.door_number === row.door_number);
    assert.ok(selected, "Each of 417 approved active vehicles selectable");
    assert.ok(identity.matchesVehicleSearch(selected, row.door_number.replaceAll("-", "")));
  }
  assert.ok(base.filter(v => v.is_active).every(v => selectable.some(s => s.id === v.id)));
  assert.ok(identity.vehicleLabel({ ...payload[0], plate_number: null }).includes("Plate unavailable"));
  console.log("production-fleet: PASS — 743 total; 742 006; 417 new active; 0 duplicate Doors; 20 review absent; all original 326 fields/UUIDs and actual 14 authorization UUID links preserved; profiles/assignments unchanged; second run 0 inserts/417 skips; rollback at insert 8; strict read-only preflight; all 417 searchable/selectable");
} finally { await client.end(); }
