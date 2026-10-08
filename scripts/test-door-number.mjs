/**
 * Focused Door Number regression suite. Uses only a disposable local database.
 * DATABASE_URL=postgresql://runner@127.0.0.1:5440/lvas_door_test \
 *   node scripts/test-door-number.mjs [path/to/audited-vehicles.json]
 * No application env files are loaded. Never run against Production.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import vm from "node:vm";
import pg from "pg";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1", "Disposable localhost database required");
assert.equal(url.port, "5440", "Dedicated fixture port required");
assert.equal(url.pathname, "/lvas_door_test", "Dedicated fixture database required");
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
const source = (file) => readFileSync(path.join(root, file), "utf8");
const fixturePath = process.argv[2];
const fixture = fixturePath ? JSON.parse(readFileSync(fixturePath, "utf8")) : (() => {
  const rows = Array.from({ length: 325 }, (_, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    plate_number: `TEST-${i}`, make: "Toyota", model: "HILUX / DC / 4X4",
    year: 2021, color: null, is_active: i !== 1,
    notes: `Asset No: 006-01-${String(i + 100).padStart(3, "0")} | Type: LMV`,
    created_by: null,
  }));
  for (const [index, plate, door] of [
    [0, "1-UEU", "006-01-011"], [1, "1296-GVD", "006-01-756"],
    [2, "8178-URB", "006-01-736"],
  ]) Object.assign(rows[index], { plate_number: plate, notes: `Asset No: ${door}` });
  rows.push({
    id: "00000000-0000-4000-8000-000000000326",
    plate_number: "5546", make: "eeee", model: "eeee", year: 1996,
    color: null, is_active: true, notes: null, created_by: null,
  });
  return rows;
})();
assert.equal(fixture.length, 326);
const migration = source("db/migrations/20261008_vehicle_door_number.sql");
const modules = new Map();
const qrValues = [];
let fakeError = null;
const now = new Date("2026-10-08T16:30:00Z");
const adapter = {
  query: async (sql, params = []) => (await client.query(sql, params)).rows,
  queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] ?? null,
  getPool: () => client,
  isUniqueViolation: (error) => error?.code === "23505",
  pgErrorMessage: () => "Safe database error",
};
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const cjsModule = { exports: {} };
  modules.set(file, cjsModule.exports);
  const require = (name) => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/security/rate-limit") return { consumeRateLimit: async () => ({ allowed: true }) };
    if (name === "@/lib/auth/guards") return { requireRole: async () => ({ id: fixture[0].created_by ?? "00000000-0000-4000-8000-000000000999" }) };
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name === "@/lib/db/queries" && fakeError) return {
      insertVehicle: async () => { throw fakeError; },
      updateVehicleRow: async () => { throw fakeError; },
    };
    if (name === "qrcode.react") return {
      QRCodeSVG: (props) => { qrValues.push(props.value); return React.createElement("svg", { "data-qr": props.value }); },
    };
    if (name.startsWith("@/components/ui/")) return new Proxy({}, {
      get: (_target, key) => key === "__esModule" ? false :
        ({ children, ...props }) => React.createElement("div", props, children),
    });
    if (name === "@/components/brand/brand-logo") return { BrandLogo: () => null };
    if (name.startsWith("@/")) {
      const target = path.join(root, name.slice(2));
      if (target.endsWith(".json")) return JSON.parse(readFileSync(target, "utf8"));
      const resolved = [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`].find(existsSync);
      assert.ok(resolved, name);
      return load(path.relative(root, resolved));
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { require, module: cjsModule, exports: cjsModule.exports, process, console, Date, Intl, URL, Buffer, setTimeout }, { filename: file });
  modules.set(file, cjsModule.exports);
  return cjsModule.exports;
}

try {
  assert.equal((await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0,
    "Fixture database must be empty; never replace existing data");
  const legacySchema = source("db/schema.sql")
    .replace("  door_number text,\n", "")
    .replace(/create unique index if not exists vehicles_door_number_unique[\s\S]*?where door_number is not null;\n/, "");
  await client.query(legacySchema);
  for (const id of new Set(fixture.map((v) => v.created_by).filter(Boolean))) {
    await client.query("insert into profiles(id,full_name,email,role) values($1,'Synthetic fixture creator',$2,'admin')",
      [id, `${id}@example.invalid`]);
  }
  for (const row of fixture) {
    await client.query(`insert into vehicles(id,plate_number,make,model,year,color,is_active,notes,created_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [
      row.id, row.plate_number, row.make, row.model, row.year, row.color,
      row.is_active, row.notes, row.created_by,
    ]);
  }
  const vehicle = fixture.find((v) => v.plate_number === "8178-URB");
  const employeeId = "99999999-0000-4000-8000-000000000001";
  const authorizationId = "99999999-0000-4000-8000-000000000002";
  const token = "99999999-0000-4000-8000-000000000003";
  await client.query(`insert into employees(id,badge,full_name,national_id,mobile)
    values($1,'DOOR-TEST','Synthetic Door Driver','1234567890','0500000000')`, [employeeId]);
  await client.query(`insert into authorizations(id,vehicle_id,employee_id,public_token,status,start_date,end_date,duration_label,location)
    values($1,$2,$3,$4,'approved','2026-10-08','2026-10-12','Fixture','Jafurah')`,
    [authorizationId, vehicle.id, employeeId, token]);
  const before = (await client.query("select id,plate_number,make,model,year,color,is_active,notes,created_by,created_at from vehicles order by id")).rows;
  const relationshipBefore = (await client.query("select * from authorizations")).rows;
  await client.query(migration);
  const count = (await client.query(`select count(*)::int total,
    count(door_number)::int populated, count(*) filter(where door_number is null)::int missing,
    (count(door_number)-count(distinct door_number))::int duplicates from vehicles`)).rows[0];
  assert.deepEqual(count, { total: 326, populated: 325, missing: 1, duplicates: 0 });
  assert.deepEqual((await client.query("select id,plate_number,make,model,year,color,is_active,notes,created_by,created_at from vehicles order by id")).rows, before);
  assert.deepEqual((await client.query("select * from authorizations")).rows, relationshipBefore);
  for (const [plate, door] of [
    ["1-UEU", "006-01-011"], ["1296-GVD", "006-01-756"],
    ["8178-URB", "006-01-736"], ["5546", null],
  ]) assert.equal((await client.query("select door_number from vehicles where plate_number=$1", [plate])).rows[0].door_number, door);
  const once = (await client.query("select * from vehicles order by id")).rows;
  await client.query(migration);
  assert.deepEqual((await client.query("select * from vehicles order by id")).rows, once, "Rerun is a no-op");
  await assert.rejects(client.query("update vehicles set door_number='006-01-736' where plate_number='5546'"), { code: "23505" });

  // Invalid/ambiguous labels and nullable legacy rows remain safe.
  for (const [plate, notes] of [
    ["INVALID", "Asset No: not-valid"], ["TWO-VALID", "Asset No: 006-01-900 | Asset No: 006-01-901"],
    ["TWO-LABELS", "Asset No: 006-01-902 | Asset No: invalid"], ["UNLABELLED", "006-01-903"],
  ]) await client.query("insert into vehicles(plate_number,make,model,notes) values($1,'Test','Test',$2)", [plate, notes]);
  await client.query(migration);
  assert.equal((await client.query("select count(*)::int n from vehicles where plate_number in ('INVALID','TWO-VALID','TWO-LABELS','UNLABELLED') and door_number is not null")).rows[0].n, 0);
  await client.query("delete from vehicles where plate_number in ('INVALID','TWO-VALID','TWO-LABELS','UNLABELLED')");

  const identity = load("lib/vehicles/identity.ts");
  const queries = load("lib/db/queries.ts");
  const active = await queries.listActiveVehicles();
  assert.equal(active.length, 325);
  const option = active.find((v) => v.id === vehicle.id);
  assert.equal(option.door_number, "006-01-736");
  assert.equal(identity.vehicleLabel(option), "Door 006-01-736 — Plate 8178-URB — Toyota HILUX / DC / 4X4");
  for (const query of ["006-01-736", "00601736", "8178-URB", "8178 urb"])
    assert.equal(identity.matchesVehicleSearch(option, query), true);
  const missing = active.find((v) => v.plate_number === "5546");
  assert.ok(identity.vehicleLabel(missing).startsWith("Door No. unavailable — Plate 5546"));
  assert.equal(identity.matchesVehicleSearch(missing, "5546"), true);
  const detail = await queries.getAuthorizationDetail(authorizationId);
  assert.equal(detail.vehicle_id, vehicle.id);
  assert.equal(detail.vehicles.door_number, option.door_number);
  assert.equal((await queries.getAuthorizationByPublicToken(token)).vehicles.door_number, option.door_number);
  assert.equal((await queries.listAuthorizationsByEmployeeId(employeeId))[0].door_number, option.door_number);
  const gate = load("lib/authorizations/gate-verification.ts");
  const lookupSource = source("lib/authorizations/gate-lookup.ts");
  const lookupSQL = lookupSource.match(/queryOne<GateAuthorizationRow>\(\s*`([\s\S]*?)`/)[1];
  const row = (await client.query(lookupSQL, [token])).rows[0];
  const result = gate.evaluateGateAuthorization(row, now);
  assert.equal(result.state, "valid");
  assert.equal(result.details.doorNumber, option.door_number);
  await client.query("update vehicles set door_number='006-01-999' where id=$1", [vehicle.id]);
  const fresh = (await client.query(lookupSQL, [token])).rows[0];
  assert.equal(gate.evaluateGateAuthorization(fresh, now).details.doorNumber, "006-01-999");
  await client.query("update vehicles set door_number=$2 where id=$1", [vehicle.id, option.door_number]);
  const passModule = load("components/authorizations/digital-pass.tsx");
  const verificationUrl = `https://example.invalid/verify/${token}`;
  const pass = renderToStaticMarkup(React.createElement(passModule.DigitalAuthorizationPass, { request: detail, verificationUrl }));
  assert.ok(pass.includes(option.door_number), "Pass shows Door Number");
  assert.equal(qrValues.at(-1), verificationUrl);
  assert.ok(!qrValues.at(-1).includes(option.door_number), "QR is only verification URL");
  const validation = load("lib/validations/index.ts").vehicleFormSchema;
  const input = { plate_number: "TEST", make: "Test", model: "Test", year: "", color: "", notes: "" };
  assert.equal(validation.parse({ ...input, door_number: "  006-01-001  " }).door_number, "006-01-001");
  for (const door_number of ["", "   ", null, undefined])
    assert.equal(validation.parse({ ...input, door_number }).door_number, null);
  assert.equal(validation.safeParse({ ...input, door_number: "x".repeat(65) }).success, false);
  fakeError = { code: "23505", constraint: "vehicles_door_number_unique" };
  modules.delete("actions/vehicles.ts");
  const actions = load("actions/vehicles.ts");
  assert.match((await actions.createVehicle(input)).error, /Door Number/);
  assert.match((await actions.updateVehicle({ ...input, id: vehicle.id })).error, /Door Number/);
  const combobox = source("components/vehicles/vehicle-combobox.tsx");
  assert.match(combobox, /matchesVehicleSearch/);
  assert.match(combobox, /vehicle\.id/);
  console.log("Door Number: PASS", JSON.stringify(count));
  console.log("Plates, notes, vehicle UUIDs, authorization UUID relationship, rerun, nulls, leading zeros, uniqueness, search, tracking, pass, live gate refresh and QR privacy: PASS");
} finally {
  await client.end();
}
