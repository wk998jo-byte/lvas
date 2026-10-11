/**
 * Real SQL/provisioning/reset actions against an EMPTY disposable localhost DB.
 * Never loads application env files. No SMTP or Production connections.
 * LVAS_DISPOSABLE_TEST_DB=1 DATABASE_URL=postgresql://runner@127.0.0.1:15439/heliumdb
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import pg from "pg";
import ts from "typescript";
import { spawnSync } from "node:child_process";
import { provisionJaved, JAVED, CONFIRMATION } from "./provision-javed.mjs";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.LVAS_DISPOSABLE_TEST_DB, "1");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "15439");
assert.equal(url.pathname, "/heliumdb");
const root = path.resolve(import.meta.dirname, "..");
const source = file => readFileSync(path.join(root, file), "utf8");
const native = createRequire(import.meta.url);
const client = new pg.Client({ connectionString: url.href });
await client.connect();
const cache = new Map();
let actor, deliveredReset;
const adapter = {
  query: async (sql, params) => (await client.query(sql, params)).rows,
  queryOne: async (sql, params) => (await client.query(sql, params)).rows[0] ?? null,
  getPool: () => ({ connect: async () => ({
    query: (...args) => client.query(...args), release: () => {},
  }) }),
  isOverlapViolation: () => false,
  pgErrorMessage: () => "Synthetic database error",
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const loaded = { exports: {} };
  cache.set(file, loaded.exports);
  const require = name => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/auth/guards") return { requireRole: async () => actor };
    if (name === "@/lib/auth/mail") return {
      isPasswordResetEmailConfigured: () => true,
      sendPasswordResetEmail: async (email, resetUrl) => { deliveredReset = { email, resetUrl }; },
    };
    if (name === "@/lib/auth/session") return {
      createSession: async () => "synthetic-cookie",
      setSessionCookie: async () => {},
    };
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async () => ({ allowed: true }),
      refundSuccessfulAttempt: async () => {},
    };
    if (name === "next/headers") return { headers: async () => new Map() };
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(source(stem));
      const resolved = [stem + ".ts", stem + ".tsx", stem + "/index.ts"]
        .find(candidate => existsSync(path.join(root, candidate)));
      assert.ok(resolved, name);
      return load(resolved);
    }
    return native(name);
  };
  vm.runInNewContext(ts.transpileModule(source(file), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, {
    module: loaded, exports: loaded.exports, require, console, Buffer, URL,
    process: { env: { NODE_ENV: "production", APP_URL: "https://onboarding.example.invalid" } },
  });
  return loaded.exports;
}
async function fingerprint(table, suffix = "", params = []) {
  assert.ok(["profiles", "employees", "sessions", "authorizations", "notifications", "logistics_approver_locations"].includes(table));
  return (await client.query(
    `select md5(coalesce(string_agg(row_to_json(t)::text, '' order by row_to_json(t)::text), '')) as hash from ${table} t ${suffix}`,
    params,
  )).rows[0].hash;
}
const profileIds = new Map();
const requests = new Map();
async function requestEmployee() {
  const id = randomUUID();
  await client.query("insert into employees(id,badge,full_name,role) values($1,$2,'Synthetic requester','other_employee')",
    [id, `TEST-${id}`]);
  return id;
}
try {
  assert.equal((await client.query(
    "select count(*)::int n from information_schema.tables where table_schema='public'",
  )).rows[0].n, 0, "Only an EMPTY disposable database is permitted");
  await client.query(source("db/schema.sql"));
  const team = load("lib/approvals/logistics-team.ts");
  const queries = load("lib/db/queries.ts");
  const password = load("lib/auth/password.ts");
  const auth = load("actions/auth.ts");
  const approvals = load("actions/approvals.ts");
  const employeeId = randomUUID();
  await client.query("insert into employees(id,badge,full_name,role) values($1,$2,$3,'other_employee')",
    [employeeId, JAVED.badge, JAVED.fullName]);
  const originalHash = await password.hashPassword("Existing-synthetic-password");
  for (const person of team.LOGISTICS_ROSTER.filter(person => person.badge !== JAVED.badge)) {
    const id = randomUUID();
    profileIds.set(person.email, id);
    await client.query("insert into profiles(id,full_name,email,role,password_hash) values($1,$2,$3,'logistics_approver',$4)",
      [id, person.fullName, person.email, originalHash]);
    await client.query("insert into sessions(profile_id,token_hash,expires_at) values($1,$2,'2099-01-01')", [id, randomUUID()]);
    for (const location of person.locations) {
      await client.query("insert into logistics_approver_locations values($1,$2)", [id, location]);
    }
  }
  const vehicles = new Map();
  for (const location of team.PROJECT_LOCATIONS) {
    const vehicle = randomUUID();
    vehicles.set(location, vehicle);
    await client.query("insert into vehicles(id,door_number,make,model) values($1,$2,'Synthetic','Fixture')",
      [vehicle, `TEST-${location}`]);
    await client.query(`insert into authorizations(vehicle_id,start_date,end_date,duration_label,status,location,approval_stage,employee_id)
      values($1,'2030-01-01','2030-01-02','2 days','approved',$2,2,$3)`, [vehicle, location, await requestEmployee()]);
  }
  for (const location of team.PROJECT_LOCATIONS) {
    const id = randomUUID();
    requests.set(location, id);
    // Asset Department's vehicle conflict is in Dhahran Base: redact its details.
    await client.query(`insert into authorizations(id,vehicle_id,start_date,end_date,duration_label,status,location,approval_stage,employee_id)
      values($1,$2,'2030-01-01','2030-01-02','2 days','pending',$3,1,$4)`,
    [id, vehicles.get(location === "Asset Department" ? "Dhahran Base" : location), location, await requestEmployee()]);
  }
  const liveId = randomUUID();
  await client.query(`insert into authorizations(id,vehicle_id,start_date,end_date,duration_label,status,location,approval_stage,employee_id)
    values($1,$2,'2031-01-01','2031-01-02','2 days','pending','Dhahran Base',2,$3)`,
  [liveId, vehicles.get("Dhahran Base"), await requestEmployee()]);
  const protectedBefore = {};
  for (const table of ["profiles", "employees", "sessions", "authorizations", "notifications", "logistics_approver_locations"]) {
    protectedBefore[table] = await fingerprint(table);
  }
  assert.equal((await provisionJaved(client)).applied, false, "Default must be read-only");
  for (const [table, before] of Object.entries(protectedBefore)) assert.equal(await fingerprint(table), before);
  await assert.rejects(provisionJaved(client, { apply: true }), /confirmation/);
  // Inject an unexpected extra assignment: postcondition must roll back both inserts.
  const faulty = { query: async (sql, params) => {
    const result = await client.query(sql, params);
    if (/insert into logistics_approver_locations/.test(sql)) {
      await client.query("insert into logistics_approver_locations values($1,'Dhahran Base')", [params[0]]);
    }
    return result;
  } };
  await assert.rejects(provisionJaved(faulty, { apply: true, confirmation: CONFIRMATION }), /assignments/);
  assert.equal((await queries.getProfileByEmail(JAVED.email)), null, "Postcondition failure must roll back profile");
  // Duplicate identity must be refused, including differently cased email.
  const duplicateId = randomUUID();
  await client.query("insert into profiles(id,full_name,email,role) values($1,'Different identity',$2,'admin')",
    [duplicateId, JAVED.email.toUpperCase()]);
  await assert.rejects(provisionJaved(client, { apply: true, confirmation: CONFIRMATION }));
  await client.query("delete from profiles where id=$1", [duplicateId]);
  const created = await provisionJaved(client, { apply: true, confirmation: CONFIRMATION });
  assert.equal(created.applied, true);
  const javed = await queries.getProfileByEmail(JAVED.email);
  profileIds.set(JAVED.email, javed.id);
  assert.equal(javed.password_hash, null);
  assert.notEqual(javed.id, employeeId);
  assert.deepEqual(Array.from(await queries.listLocationsForApprover(javed.id)), ["Asset Department"]);
  const profileSnapshot = await fingerprint("profiles");
  const assignmentSnapshot = await fingerprint("logistics_approver_locations");
  assert.equal((await provisionJaved(client, { apply: true, confirmation: CONFIRMATION })).applied, false);
  assert.equal(await fingerprint("profiles"), profileSnapshot);
  assert.equal(await fingerprint("logistics_approver_locations"), assignmentSnapshot);
  for (const table of ["employees", "sessions", "authorizations", "notifications"]) {
    assert.equal(await fingerprint(table), protectedBefore[table]);
  }
  assert.equal(await fingerprint("profiles", "where lower(email) <> lower($1)", [JAVED.email]), protectedBefore.profiles);
  assert.equal(await fingerprint("logistics_approver_locations", "where profile_id <> $1", [javed.id]), protectedBefore.logistics_approver_locations);

  // Actual reset issuance/delivery action, SQL redemption, password hash and login.
  assert.equal((await auth.signInWithPassword({ email: JAVED.email, password: "Synthetic-new-password" })).ok, false);
  const reset = await auth.requestPasswordReset({ email: JAVED.email });
  assert.equal(reset.ok, true);
  assert.equal(deliveredReset.email, JAVED.email);
  const token = new URL(deliveredReset.resetUrl).pathname.split("/").at(-1);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const stored = (await client.query("select token_hash, expires_at > now() as live from password_reset_tokens where profile_id=$1", [javed.id])).rows[0];
  assert.equal(stored.token_hash, tokenHash);
  assert.notEqual(stored.token_hash, token);
  assert.equal(stored.live, true);
  const resetInput = { token, new_password: "Synthetic-new-password", confirm_password: "Synthetic-new-password" };
  assert.equal((await auth.resetPasswordWithToken(resetInput)).ok, true);
  assert.equal((await auth.resetPasswordWithToken(resetInput)).ok, false, "Token reuse rejected");
  assert.equal((await auth.signInWithPassword({ email: JAVED.email, password: resetInput.new_password })).ok, true);
  assert.equal(await fingerprint("profiles", "where lower(email) <> lower($1)", [JAVED.email]), protectedBefore.profiles);
  assert.equal(await fingerprint("sessions"), protectedBefore.sessions);
  const afterPassword = await fingerprint("profiles");
  assert.equal((await provisionJaved(client, { apply: true, confirmation: CONFIRMATION })).applied, false);
  assert.equal(await fingerprint("profiles"), afterPassword, "Rerun preserves Javed's chosen password too");
  await queries.replacePasswordResetToken({ profileId: javed.id, tokenHash: "expired-synthetic", expiresAt: "2000-01-01" });
  assert.equal(await queries.resetPasswordWithTokenHash({ tokenHash: "expired-synthetic", passwordHash: originalHash }), false);

  for (const person of team.LOGISTICS_ROSTER) {
    actor = { id: profileIds.get(person.email), role: "logistics_approver" };
    const scope = await queries.listLocationsForApprover(actor.id);
    assert.deepEqual(Array.from(scope).sort(), Array.from(person.locations).sort());
    const queue = await queries.listPendingAuthorizations(200, { stage: 1, locations: scope });
    assert.ok(queue.every(row => scope.includes(row.location)));
    const history = await queries.listHistoryAuthorizations(300, scope);
    assert.deepEqual(Array.from(new Set(history.map(row => row.location))).sort(), Array.from(scope).sort());
    // Insights intentionally omit location/id. Compare the actual projected
    // records with an independently scoped SQL projection, not mock-only fields.
    const expectedInsights = (await client.query(`
      select a.status, a.created_at, a.approved_at, a.rejected_at,
        case when v.id is null then null else jsonb_build_object(
          'door_number',v.door_number,'plate_number',v.plate_number
        ) end as vehicles
      from authorizations a left join vehicles v on v.id=a.vehicle_id
      where a.location = any($1::text[]) order by a.created_at desc
    `, [scope])).rows;
    assert.deepEqual(JSON.parse(JSON.stringify(await queries.listInsightAuthorizations("2020-01-01", 500, scope))),
      JSON.parse(JSON.stringify(expectedInsights)));
    for (const location of team.PROJECT_LOCATIONS) {
      const recipients = await queries.listLogisticsApproverIdsForLocation(location);
      assert.equal(recipients.includes(actor.id), scope.includes(location), "Notification recipient scope");
      assert.equal(Boolean(await queries.getAuthorizationDetail(requests.get(location), scope)), scope.includes(location));
      if (!scope.includes(location)) {
        assert.equal((await approvals.approveAuthorization({ id: requests.get(location) })).ok, false);
        assert.equal((await approvals.rejectAuthorization({ id: requests.get(location), rejection_reason: "Synthetic cross-project denial" })).ok, false);
      }
    }
    assert.equal((await approvals.approveAuthorization({ id: liveId })).ok, false, "Stage 2 stays with admin");
  }
  actor = { id: javed.id, role: "logistics_approver" };
  const assetQueue = await queries.listPendingAuthorizations(200, { stage: 1, locations: ["Asset Department"] });
  assert.equal(JSON.stringify(assetQueue[0].activeConflict), '{"restricted":true}');
  // An old spelling stored in an assignment grants NO canonical Fabshop access.
  const legacy = randomUUID();
  await client.query("insert into profiles(id,full_name,email,role) values($1,'Legacy test','legacy@example.invalid','logistics_approver')", [legacy]);
  await client.query("insert into logistics_approver_locations values($1,$2)", [legacy, ["Fabshop", "Salasil"].join("-")]);
  assert.equal((await queries.listLogisticsApproverIdsForLocation("Fabshop-Salsil")).includes(legacy), false);
  actor = { id: legacy, role: "logistics_approver" };
  assert.equal((await approvals.approveAuthorization({ id: requests.get("Fabshop-Salsil") })).ok, false);
  // Positive action routing for the new department and canonical Fabshop.
  actor = { id: javed.id, role: "logistics_approver" };
  assert.equal((await approvals.approveAuthorization({ id: requests.get("Asset Department") })).ok, true);
  actor = { id: profileIds.get(team.LOGISTICS_ROSTER.find(person => person.badge === "81337").email), role: "logistics_approver" };
  assert.equal((await approvals.rejectAuthorization({ id: requests.get("Fabshop-Salsil"), rejection_reason: "Synthetic assigned-project rejection" })).ok, true);
  assert.equal((await queries.getAuthorizationById(liveId)).approval_stage, 2);
  assert.equal((await queries.getAuthorizationById(liveId)).status, "pending");
  // CLI safety: no target / wrong target / missing confirmation cannot execute.
  for (const args of [[], ["--apply"], ["--expected-target=wrong:15439/heliumdb"],
    ["--apply", "--expected-target=127.0.0.1:15439/heliumdb"]]) {
    const result = spawnSync(process.execPath, ["scripts/provision-javed.mjs", ...args], {
      cwd: root, env: { PATH: process.env.PATH, DATABASE_URL: url.href }, encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes(url.href), "No connection string disclosure");
  }
  console.log("logistics-alignment: PASS (real SQL, exact roster access, notifications, approve/reject denials, conflict redaction, stage-2 preservation, dry-run, rollback, duplicates, NULL-password/reset/login, other credentials/sessions, safe rerun, CLI confirmation)");
} finally {
  await client.end();
}
