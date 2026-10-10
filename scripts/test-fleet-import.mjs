/**
 * Disposable PostgreSQL fleet preparation verification; leaves synthetic UI
 * fixtures only in the dedicated localhost DB. Never loads app env files.
 * DATABASE_URL=postgresql://postgres@127.0.0.1:15439/heliumdb \
 * node scripts/test-fleet-import.mjs production-snapshot.json [ready.json]
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import pg from "pg";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { importReady, assertDisposable } from "./import-fleet-006.mjs";

assertDisposable(process.env.DATABASE_URL ?? "");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = p => readFileSync(path.join(root, p), "utf8");
const snapshot = JSON.parse(readFileSync(process.argv[2], "utf8"));
assert.equal(snapshot.length, 326, "Fresh 326-vehicle read-only snapshot required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const admin = "99999999-0000-4000-8000-000000000900";
const logistics = "99999999-0000-4000-8000-000000000901";
const employee = "99999999-0000-4000-8000-000000000902";
const employee2 = "99999999-0000-4000-8000-000000000903";
const nativeRequire = createRequire(import.meta.url);
const cache = new Map(), qr = [];
const adapter = {
  query: async (sql, params = []) => (await client.query(sql, params)).rows,
  queryOne: async (sql, params = []) => (await client.query(sql, params)).rows[0] ?? null,
  getPool: () => client, execute: async (sql, params = []) => (await client.query(sql, params)).rowCount,
  isUniqueViolation: e => e?.code === "23505", isOverlapViolation: e => e?.code === "23P01",
  pgErrorMessage: () => "Safe database error",
};
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-10T16:30:00Z"])); }
}
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const cjs = { exports: {} };
  cache.set(file, cjs.exports);
  const require = name => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/auth/guards") return { requireRole: async () => ({ id: admin, role: "admin" }) };
    if (name === "@/lib/auth/approver") return { getDefaultApproverId: async () => admin };
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async () => ({ allowed: true }), refundSuccessfulAttempt: async () => {},
    };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name === "next/navigation") return { notFound() { throw new Error("Not found"); } };
    if (name === "next/link") return function TestLink({ children }) { return React.createElement("a", null, children); };
    if (name === "qrcode.react") return { QRCodeSVG: ({ value }) => {
      qr.push(value); return React.createElement("svg", { "data-qr": value });
    } };
    if (name.startsWith("@/components/ui/")) return new Proxy({}, {
      get: (_, key) => key === "__esModule" ? false : ({ children }) => React.createElement("div", null, children),
    });
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(source(stem));
      const target = [stem + ".ts", stem + ".tsx", stem + "/index.ts"].find(p => existsSync(path.join(root, p)));
      assert.ok(target, name);
      return load(target);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module: cjs, exports: cjs.exports, require, Date: TestDate, Intl, URL, Buffer,
    process: { env: { APP_URL: "https://example.invalid" } }, console, setTimeout }, { filename: file });
  return cjs.exports;
}
const canonical = async () => (await client.query("select * from vehicles where id=any($1::uuid[]) order by id",
  [snapshot.map(r => r.id)])).rows;
const candidate = (door, plate = null) => ({
  door_number: door, plate_number: plate, make: "Synthetic", model: "Fleet",
  year: null, status: "UNKNOWN", category: ["Synthetic test"], chassis: null,
  classification: "MISSING — READY TO IMPORT", conflicts: [],
  sources: [{ source_sheet: "Synthetic", source_row: 42 }], is_active: null,
});

try {
  assert.equal((await client.query("select count(*)::int n from information_schema.tables where table_schema='public'")).rows[0].n, 0,
    "Only an EMPTY disposable database is permitted; never reset real data");
  await client.query(source("db/schema.sql").replace("  plate_number text,", "  plate_number text not null,"));
  for (const id of new Set([...snapshot.map(r => r.created_by).filter(Boolean), admin, logistics])) {
    await client.query("insert into profiles(id,full_name,email,role) values($1,'Synthetic fixture actor',$2,$3)",
      [id, `${id}@example.invalid`, id === logistics ? "logistics_approver" : "admin"]);
  }
  await client.query("insert into logistics_approver_locations(profile_id,location) values($1,'Jafurah')", [logistics]);
  for (const r of snapshot) {
    await client.query(`insert into vehicles(id,door_number,plate_number,make,model,year,color,is_active,notes,created_by,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [r.id, r.door_number, r.plate_number, r.make, r.model, r.year, r.color,
      r.is_active, r.notes, r.created_by, r.created_at, r.updated_at]);
  }
  const original = await canonical();
  await client.query(source("db/migrations/20261009_vehicle_plate_nullable.sql"));
  await client.query(source("db/migrations/20261009_vehicle_plate_nullable.sql"));
  assert.deepEqual(await canonical(), original, "Nullable migration and rerun do not rewrite any vehicle");
  const nullA = candidate("006-99-001"), nullB = candidate("006-99-002");
  await assert.rejects(importReady(client, [nullA], {}), /approved availability/);
  assert.equal((await client.query("select count(*)::int n from vehicles")).rows[0].n, 326);
  const approvedPlan = { [nullA.door_number]: true, [nullB.door_number]: true };
  assert.equal((await importReady(client, [nullA, nullB], approvedPlan)).inserted, 2);
  assert.equal((await client.query("select count(*)::int n from vehicles")).rows[0].n, 326, "Dry-run rolled back");
  assert.equal((await importReady(client, [nullA, nullB], approvedPlan, { apply: true })).inserted, 2);
  const uuidA = (await client.query("select id from vehicles where door_number=$1", [nullA.door_number])).rows[0].id;
  assert.equal((await importReady(client, [nullA, nullB], {}, { apply: true })).skipped, 2);
  assert.equal((await client.query("select id from vehicles where door_number=$1", [nullA.door_number])).rows[0].id, uuidA);
  await assert.rejects(client.query("insert into vehicles(door_number,make,model) values('006-99-001','Test','Test')"), { code: "23505" });
  await assert.rejects(client.query("insert into vehicles(plate_number,make,model) values($1,'Test','Test')",
    [snapshot.find(r => r.plate_number && !r.plate_number.startsWith("006-")).plate_number]), { code: "23505" });
  // Unexpected collision after a successful earlier row must roll everything back.
  const first = candidate("006-99-003"), collision = candidate("006-99-004", snapshot[0].plate_number);
  await assert.rejects(importReady(client, [first, collision], {
    [first.door_number]: true, [collision.door_number]: true,
  }, { apply: true }), e => e.code === "23505");
  assert.equal((await client.query("select count(*)::int n from vehicles where door_number='006-99-003'")).rows[0].n, 0);
  // Test the actual workbook READY payload, with explicit TEST-ONLY availability.
  if (process.argv[3]) {
    const ready = JSON.parse(readFileSync(process.argv[3], "utf8"));
    const testPlan = Object.fromEntries(ready.map(r => [r.door_number, true]));
    const firstRun = await importReady(client, ready, testPlan, { apply: true });
    assert.equal(firstRun.inserted, ready.length);
    assert.equal((await importReady(client, ready, {}, { apply: true })).skipped, ready.length);
  }
  assert.deepEqual(await canonical(), original, "All 326 Production snapshot records preserved exactly");
  const queries = load("lib/db/queries.ts");
  const identity = load("lib/vehicles/identity.ts");
  const selectable = (await queries.listActiveVehicles()).find(r => r.id === uuidA);
  assert.ok(selectable && selectable.plate_number === null);
  assert.equal(identity.vehicleLabel(selectable), "Door 006-99-001 — Plate unavailable — Synthetic Fleet");
  assert.ok(identity.matchesVehicleSearch(selectable, "00699001"));
  assert.ok(identity.matchesVehicleSearch(selectable, "synthetic"));
  const existingPlate = (await queries.listActiveVehicles()).find(r => r.plate_number === "8178-URB");
  assert.ok(identity.matchesVehicleSearch(existingPlate, "8178 urb"));
  const schema = load("lib/validations/index.ts").vehicleFormSchema;
  const input = { door_number: " 006-99-005 ", plate_number: " ", make: "Synthetic", model: "Admin", year: "", color: "", notes: "" };
  assert.equal(schema.parse(input).plate_number, null);
  const created = await load("actions/vehicles.ts").createVehicle(input);
  assert.ok(created.ok && created.data.plate_number === null, JSON.stringify(created));
  for (const [id, badge] of [[employee, "FLEET-NULL"], [employee2, "FLEET-NULL-2"]]) {
    await client.query("insert into employees(id,badge,full_name,national_id,mobile,role) values($1,$2,'Synthetic Fleet Driver','1234567890','0500000000','other_employee')", [id, badge]);
  }
  const receipt = await load("actions/public-requests.ts").submitPublicRequest({
    employee_id: employee, id_last4: "7890", vehicle_id: uuidA,
    start_date: "2026-10-10", end_date: "2026-10-12", duration_label: "Custom (3 days)",
    usage_after: "19:00", contact_mobile: "0500000000", purpose: "Disposable null plate test",
    location: "Jafurah", justification: "Synthetic test only",
  });
  assert.ok(receipt.ok, JSON.stringify(receipt));
  const authorization = (await client.query("select * from authorizations where public_token=$1", [receipt.data.token])).rows[0];
  assert.equal(authorization.vehicle_id, uuidA);
  await client.query("update authorizations set status='approved',approval_stage=2,first_approver_id=$2,first_approved_at=now(),approved_at=now() where id=$1", [authorization.id, logistics]);
  const beforeLinks = (await client.query("select id,vehicle_id from authorizations order by id")).rows;
  assert.equal((await importReady(client, [nullA, nullB], {}, { apply: true })).skipped, 2);
  assert.deepEqual((await client.query("select id,vehicle_id from authorizations order by id")).rows, beforeLinks);
  const detail = await queries.getAuthorizationDetail(authorization.id);
  assert.equal(detail.vehicles.plate_number, null);
  const byToken = await queries.getAuthorizationByPublicToken(receipt.data.token);
  assert.equal(byToken.vehicles.plate_number, null);
  const gateSQL = source("lib/authorizations/gate-lookup.ts").match(/queryOne<GateAuthorizationRow>\(\s*`([\s\S]*?)`/)[1];
  const gateRow = (await client.query(gateSQL, [receipt.data.token])).rows[0];
  const gate = load("lib/authorizations/gate-verification.ts").evaluateGateAuthorization(gateRow, new Date("2026-10-10T16:30:00Z"));
  assert.equal(gate.state, "valid");
  assert.equal(gate.details.plate, null);
  const html = renderToStaticMarkup(React.createElement(load("components/public/gate-verification-result.tsx").GateVerificationResult, { result: gate }));
  assert.ok(html.includes("Plate unavailable"));
  const url = `https://example.invalid/verify/${receipt.data.token}`;
  const pass = renderToStaticMarkup(React.createElement(load("components/authorizations/digital-pass.tsx").DigitalAuthorizationPass, { request: detail, verificationUrl: url }));
  assert.ok(pass.includes("Plate unavailable"));
  const publicPass = renderToStaticMarkup(React.createElement(load("components/public/public-pass.tsx").PublicPass, { pass: {
    id: authorization.id, doorNumber: nullA.door_number, plate: null, vehicle: "Synthetic Fleet",
    driver: "Synthetic Fleet Driver", badge: "FLEET-NULL", startDate: "2026-10-10",
    endDate: "2026-10-12", usageAfter: "19:00", verificationUrl: url,
  } }));
  assert.ok(publicPass.includes("Plate unavailable"));
  assert.deepEqual(qr, [url, url]);
  assert.ok(qr.every(value => !value.includes(nullA.door_number)));
  const tracking = await load("app/(public)/track/[token]/page.tsx").default({ params: Promise.resolve({ token: receipt.data.token }) });
  assert.ok(renderToStaticMarkup(tracking).includes("Plate unavailable"));
  assert.deepEqual(await canonical(), original);
  console.log("fleet-import: PASS (NULL plates, uniqueness, actual admin/public request, authorization UUID, tracking/pass/gate, QR privacy, whole READY dry-run/apply/rerun, conflict rollback, exact original 326 preservation)");
  console.log("BROWSER_FIXTURE", JSON.stringify({ nullVehicleId: uuidA, authorizationId: authorization.id, token: receipt.data.token, admin, logistics, badge: "FLEET-NULL-2", last4: "7890" }));
} finally {
  await client.end();
}
