/**
 * Actual gate SELECT, evaluator, Admin end action and rendered QR sources.
 * Development-only: fixtures live in connection-local TEMP tables inside a
 * rolled-back transaction. Existing business tables/users are never changed.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { Pool } from "pg";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
const id = "11111111-1111-4111-8111-111111111111";
const token = "22222222-2222-4222-8222-222222222222";
const employeeId = "33333333-3333-4333-8333-333333333333";
const vehicleId = "44444444-4444-4444-8444-444444444444";
const profileId = "55555555-5555-4555-8555-555555555555";
const fakeEnv = { NODE_ENV: "production", APP_URL: "https://example.invalid" };
let now = "2026-10-06T16:00:00.000Z"; // Saudi 19:00.
let lookupQueries = [];
let invalidLimitCalls = 0;
let limitAllowed = true;
let databaseUnavailable = false;
const qrValues = [];
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return new Date(now).getTime(); }
}
const adapter = {
  queryOne: async (sql, params) => {
    if (databaseUnavailable) throw new Error("PRIVATE DATABASE PASSWORD/SQL DETAIL");
    lookupQueries.push({ sql, params });
    return (await client.query(sql, params)).rows[0] ?? null;
  },
  pgErrorMessage: () => "Synthetic test error",
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const cjsModule = { exports: {} };
  modules.set(file, cjsModule.exports);
  const require = (name) => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async (policy) => {
        assert.equal(policy, "tokenTracking");
        invalidLimitCalls++;
        return { allowed: limitAllowed, refundable: [] };
      },
    };
    if (name === "@/lib/auth/guards") return { requireRole: async (role) => {
      assert.equal(role, "admin"); return { id: profileId, role: "admin" };
    } };
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name === "qrcode.react") return { QRCodeSVG: ({ value }) => {
      qrValues.push(value);
      return React.createElement("svg", { "data-test-qr": value });
    } };
    if (name.startsWith("@/")) {
      const target = path.join(root, name.slice(2));
      if (target.endsWith(".json")) return JSON.parse(readFileSync(target, "utf8"));
      const candidate = [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`].find(existsSync);
      assert.ok(candidate, `Missing ${name}`);
      return load(path.relative(root, candidate));
    }
    return nativeRequire(name);
  };
  const compiled = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: file,
  }).outputText;
  vm.runInNewContext(compiled, {
    module: cjsModule, exports: cjsModule.exports, require,
    process: { env: fakeEnv }, Buffer, URL, Date: TestDate, console,
  }, { filename: file });
  modules.set(file, cjsModule.exports);
  return cjsModule.exports;
}

try {
  const identity = await client.query("select current_database() as name, current_user as role");
  assert.equal(identity.rows[0].name, "heliumdb", "Only independently confirmed Development is permitted");
  assert.equal(identity.rows[0].role, "postgres", "Unexpected database environment");
  await client.query("begin");
  // Shadow names resolve to pg_temp for this connection only. ON COMMIT DROP
  // and the final rollback prevent either fixtures or schema persisting.
  await client.query(`
    create temp table vehicles (id uuid, plate_number text, make text, model text) on commit drop;
    create temp table employees (id uuid, full_name text, badge text, national_id text, mobile text) on commit drop;
    create temp table profiles (id uuid, full_name text, email text) on commit drop;
    create temp table authorizations (
      id uuid, vehicle_id uuid, employee_id uuid, requester_id uuid, public_token uuid,
      status text, start_date date, end_date date, usage_after time, location text,
      contact_mobile text, approver_id uuid, duration_label text, purpose text,
      rejection_reason text, justification text, approval_stage integer,
      first_approver_id uuid, first_approved_at timestamptz, approved_at timestamptz,
      rejected_at timestamptz, created_at timestamptz, updated_at timestamptz
    ) on commit drop;
  `);
  await client.query("insert into pg_temp.vehicles values ($1,'TEST-PLATE','Test Make','Test Model')", [vehicleId]);
  await client.query("insert into pg_temp.employees values ($1,'Synthetic Driver','TEST-BADGE','PRIVATE ID','PRIVATE MOBILE')", [employeeId]);
  await client.query("insert into pg_temp.profiles values ($1,'Synthetic Account','private@example.invalid')", [profileId]);
  await client.query(`insert into pg_temp.authorizations
    (id, vehicle_id, employee_id, public_token, status, start_date, end_date, usage_after, location, duration_label, justification, contact_mobile)
    values ($1,$2,$3,$4,'approved','2026-10-06','2026-10-06','19:00','Jafurah','1 day','PRIVATE JUSTIFICATION','PRIVATE MOBILE')`,
  [id, vehicleId, employeeId, token]);

  const { getGateVerification } = load("lib/authorizations/gate-lookup.ts");
  const { evaluateGateAuthorization } = load("lib/authorizations/gate-verification.ts");
  const { buildGateVerificationUrl } = load("lib/authorizations/gate-url.ts");
  const { GateVerificationResult } = load("components/public/gate-verification-result.tsx");
  const verify = () => getGateVerification(token);
  const valid = await verify();
  assert.equal(valid.state, "valid");
  assert.equal(valid.details.driver, "Synthetic Driver");
  assert.equal(valid.details.badge, "TEST-BADGE");
  assert.equal(valid.details.reference, "11111111");
  assert.equal(invalidLimitCalls, 0, "known QR scans do not spend any rate budget");
  const html = renderToStaticMarkup(React.createElement(GateVerificationResult, { result: valid }));
  for (const text of ["VALID AUTHORIZATION", "TEST-PLATE", "TEST-BADGE", "Valid from", "Valid through", "19:00", "Reference", "Jafurah"]) assert.ok(html.includes(text), text);
  assert.match(html, /19:00/);
  assert.doesNotMatch(html, /Time unavailable/);
  assert.match(html, /6 Oct 2026, 19:00/);
  assert.doesNotMatch(JSON.stringify(valid) + html, /PRIVATE|private@example|11111111-1111|22222222-2222/);
  assert.deepEqual(Object.keys(valid.details).sort(), ["badge", "driver", "endDate", "location", "plate", "reference", "startDate", "usageAfter", "vehicle"].sort());
  assert.ok(lookupQueries.every(({ sql, params }) => /^select/i.test(sql.trim()) && params[0] === token && /a.public_token = \$1/.test(sql)));
  assert.ok(lookupQueries.every(({ sql }) => !/national_id|contact_mobile|justification|rejection_reason|email/.test(sql)));

  now = "2026-10-06T15:59:59.999Z";
  assert.equal((await verify()).state, "not_yet_valid");
  assert.match((await verify()).reason, /after 19:00/);
  now = "2026-10-06T20:59:59.999Z"; // final millisecond of Saudi end date.
  assert.equal((await verify()).state, "valid");
  now = "2026-10-06T21:00:00.000Z"; // Saudi midnight; UTC date is still Oct 6.
  assert.match((await verify()).reason, /expired/);
  now = "2026-10-05T20:00:00.000Z"; // after 19:00 but before start date.
  assert.equal((await verify()).state, "not_yet_valid");
  now = "2026-10-06T16:00:00.000Z";
  for (const status of ["pending", "cancelled", "rejected", "expired"]) {
    await client.query("update pg_temp.authorizations set status=$1", [status]);
    const result = await verify();
    assert.equal(result.state, "invalid");
    assert.equal(result.details, undefined);
  }
  await client.query("update pg_temp.authorizations set status='approved'");
  const { endAuthorization } = load("actions/approvals.ts");
  assert.equal((await verify()).state, "valid");
  assert.equal((await endAuthorization({ id })).ok, true, "actual Admin end action works on isolated fixtures");
  assert.equal((await verify()).state, "invalid", "next scan reflects actual cancellation immediately");
  assert.match((await verify()).reason, /cancelled/);
  await client.query("update pg_temp.authorizations set status='approved', end_date='2026-10-05'");
  assert.match((await verify()).reason, /details are not valid/);
  await client.query("update pg_temp.authorizations set start_date='2026-10-04'");
  assert.match((await verify()).reason, /expired/, "stored approved is effectively expired without a cron write");
  await client.query("update pg_temp.authorizations set start_date='2026-10-06', end_date='2026-10-06'");
  await client.query("update pg_temp.authorizations set vehicle_id=null");
  assert.equal((await verify()).state, "invalid");
  await client.query("update pg_temp.authorizations set vehicle_id=$1, employee_id=null", [vehicleId]);
  assert.equal((await verify()).state, "invalid");
  await client.query("update pg_temp.authorizations set requester_id=$1", [profileId]);
  assert.equal((await verify()).state, "valid", "existing account requester is supported without exposing email");
  assert.equal((await verify()).details.badge, null);
  await client.query("update pg_temp.authorizations set employee_id=$1, requester_id=null, usage_after='18:00'", [employeeId]);
  assert.equal((await verify()).state, "invalid");
  await client.query("update pg_temp.authorizations set usage_after='19:00'");
  assert.equal(invalidLimitCalls, 0, "all known passes bypass invalid-token throttling");
  assert.equal(evaluateGateAuthorization({ ...valid, status: "approved", start_date: "2026-02-30", end_date: "2026-10-06" }).state, "invalid");

  const beforeMalformed = lookupQueries.length;
  const malformed = await getGateVerification("not-a-uuid");
  assert.equal(malformed.state, "invalid");
  assert.equal(lookupQueries.length, beforeMalformed, "malformed tokens never reach PostgreSQL");
  assert.equal(invalidLimitCalls, 0);
  const unknown = await getGateVerification("66666666-6666-4666-8666-666666666666");
  assert.equal(unknown.state, "invalid");
  assert.equal(unknown.reason, malformed.reason);
  assert.equal(invalidLimitCalls, 1);
  limitAllowed = false;
  assert.equal((await getGateVerification("66666666-6666-4666-8666-666666666666")).state, "unavailable");
  assert.equal((await verify()).state, "valid", "a full invalid-token bucket cannot block a known gate pass");
  databaseUnavailable = true;
  const unavailable = await verify();
  assert.equal(unavailable.state, "unavailable");
  assert.doesNotMatch(JSON.stringify(unavailable), /PRIVATE|PASSWORD|SQL|22222222/);
  databaseUnavailable = false;
  for (const state of ["invalid", "not_yet_valid", "unavailable"]) {
    const output = renderToStaticMarkup(React.createElement(GateVerificationResult, { result: { ...valid, state, reason: "Safe reason" } }));
    assert.doesNotMatch(output, /VALID AUTHORIZATION|TEST-PLATE|TEST-BADGE|Synthetic Driver/);
  }

  const url = buildGateVerificationUrl(token);
  assert.equal(url, `https://example.invalid/verify/${token}`);
  assert.equal(buildGateVerificationUrl(token, " https://example.invalid/ "), url);
  for (const base of ["", "bad URL", "http://localhost:5000", "https://localhost", "https://user:password@example.invalid", "https://example.invalid?x=1", "https://example.invalid/#foo"]) {
    assert.equal(buildGateVerificationUrl(token, base), null);
  }
  assert.equal(buildGateVerificationUrl("malformed", fakeEnv.APP_URL), null);
  const previousBase = fakeEnv.APP_URL;
  delete fakeEnv.APP_URL;
  assert.equal(buildGateVerificationUrl(token), null, "production has no localhost/host-header fallback");
  fakeEnv.APP_URL = previousBase;
  const { PublicPass } = load("components/public/public-pass.tsx");
  const { DigitalAuthorizationPass } = load("components/authorizations/digital-pass.tsx");
  const pass = { id, plate: "TEST-PLATE", vehicle: "Test Make Test Model", driver: "Synthetic Driver", badge: "TEST-BADGE", startDate: "2026-10-06", endDate: "2099-01-01", usageAfter: "19:00", verificationUrl: url };
  const request = { id, public_token: token, status: "approved", start_date: pass.startDate, end_date: pass.endDate, usage_after: "19:00:00", vehicles: { plate_number: pass.plate, make: "Test Make", model: "Test Model" }, employees: { full_name: pass.driver, badge: pass.badge }, requester: null };
  const publicHtml = renderToStaticMarkup(React.createElement(PublicPass, { pass }));
  const digitalHtml = renderToStaticMarkup(React.createElement(DigitalAuthorizationPass, { request, verificationUrl: url }));
  assert.deepEqual(qrValues, [url, url], "both actual renderers encode the same live URL");
  assert.ok(qrValues.every((value) => !/TEST-PLATE|TEST-BADGE|Synthetic Driver|11111111|LVAS-PASS/.test(value)));
  assert.ok(publicHtml.includes("Print pass") && digitalHtml.includes("Save as PDF"));
  qrValues.length = 0;
  renderToStaticMarkup(React.createElement(PublicPass, { pass: { ...pass, verificationUrl: null } }));
  renderToStaticMarkup(React.createElement(DigitalAuthorizationPass, { request, verificationUrl: null }));
  assert.equal(qrValues.length, 0, "missing APP_URL generates no QR");
  for (const file of ["components/public/public-pass.tsx", "components/authorizations/digital-pass.tsx"]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.doesNotMatch(source, /LVAS-PASS|window\.location|localhost/);
    assert.match(source, /window\.print\(\)/);
  }
  const page = load("app/(public)/verify/[token]/page.tsx");
  assert.equal(page.dynamic, "force-dynamic");
  assert.equal(page.revalidate, 0);
  assert.equal(page.fetchCache, "force-no-store");
  assert.match(renderToStaticMarkup(await page.default({ params: Promise.resolve({ token }) })), /VALID AUTHORIZATION/);
  const middleware = load("lib/auth/middleware.ts");
  const { NextRequest } = nativeRequire("next/server");
  const response = await middleware.updateSession(new NextRequest(url));
  assert.equal(response.status, 200, "gate scan requires no session");
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  assert.equal(response.headers.get("location"), null);
  console.log("gate-verification: PASS (real isolated PostgreSQL SELECT, Admin cancellation, Saudi boundaries, SSR privacy, both QR sources, URL fail-safety, anonymous/no-store route)");
} finally {
  await client.query("rollback").catch(() => {});
  client.release();
  await pool.end();
}
