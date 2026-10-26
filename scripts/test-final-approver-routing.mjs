/**
 * Location-scoped final Admin routing: source contract + in-memory query
 * adapter. Never connects to Development/Production.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const source = (file) => readFileSync(path.join(root, file), "utf8");

const team = (() => {
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source("lib/approvals/logistics-team.ts"), {
      fileName: "lib/approvals/logistics-team.ts",
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      require: (name) => {
        if (name === "@/lib/approvals/logistics-roster.json") {
          return JSON.parse(source("lib/approvals/logistics-roster.json"));
        }
        return nativeRequire(name);
      },
    },
  );
  return loaded.exports;
})();

const intended = (() => {
  const loaded = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(source("lib/approvals/final-approvers.ts"), {
      fileName: "lib/approvals/final-approvers.ts",
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    {
      module: loaded,
      exports: loaded.exports,
      require: (name) => {
        if (name === "@/lib/approvals/logistics-team") return team;
        return nativeRequire(name);
      },
    },
  );
  return loaded.exports;
})();

intended.assertCanonicalFinalApproverCoverage();
assert.equal(intended.MUTEB_FINAL_LOCATIONS.length, 18);
assert.deepEqual(Array.from(intended.ABDULLAH_FINAL_LOCATIONS), ["Rigmove", "Rental", "Transport"]);
assert.equal(intended.MUTEB_FINAL_APPROVER_EMAIL, "muteb@binquraya.com");
assert.equal(intended.ABDULLAH_FINAL_APPROVER_EMAIL, "abdullah@binquraya.com");

for (const file of [
  "actions/public-requests.ts",
  "actions/approvals.ts",
  "lib/auth/mail.ts",
  "lib/notifications/approval-email.ts",
  "lib/notifications/expiry-email.ts",
]) {
  const text = source(file);
  assert.doesNotMatch(text, /getDefaultApproverId/);
  assert.doesNotMatch(text, /APPROVER_USER_ID/);
  assert.doesNotMatch(text, /abdullah@binquraya\.com|muteb@binquraya\.com/);
  assert.doesNotMatch(text, /location === ["']Rigmove["']/);
  assert.doesNotMatch(text, /location === ["']Rental["']/);
  assert.doesNotMatch(text, /location === ["']Transport["']/);
}

assert.match(source("actions/public-requests.ts"), /getEligibleFinalApproverIdForLocation/);
assert.match(source("actions/approvals.ts"), /getEligibleFinalApproverById/);
assert.match(source("db/schema.sql"), /create table if not exists final_approver_locations/);
assert.match(source("db/migrations/20261025_final_approver_locations.sql"), /final_approver_locations/);

const muteb = "muteb-admin";
const abdullah = "abdullah-admin";
const logistics = "logistics-jafurah";
const otherLogistics = "logistics-rigmove";
let actor = { id: logistics, role: "logistics_approver" };
const mappings = new Map();
const profiles = new Map([
  [muteb, { id: muteb, role: "admin", is_active: true, email: "muteb@example.invalid" }],
  [abdullah, { id: abdullah, role: "admin", is_active: true, email: "abdullah@example.invalid" }],
  [logistics, { id: logistics, role: "logistics_approver", is_active: true, email: "log@example.invalid" }],
  [otherLogistics, { id: otherLogistics, role: "logistics_approver", is_active: true, email: "rig@example.invalid" }],
]);
const authorizations = [];
const notifications = [];
const emails = [];

function resetData() {
  mappings.clear();
  for (const location of team.PROJECT_LOCATIONS) {
    mappings.set(
      location,
      intended.ABDULLAH_FINAL_LOCATIONS.includes(location) ? abdullah : muteb,
    );
  }
  profiles.get(muteb).is_active = true;
  profiles.get(muteb).role = "admin";
  profiles.get(abdullah).is_active = true;
  profiles.get(abdullah).role = "admin";
  authorizations.length = 0;
  notifications.length = 0;
  emails.length = 0;
  actor = { id: logistics, role: "logistics_approver" };
}

function one(rows) {
  return rows[0] ?? null;
}

const adapter = {
  query: async (text, params = []) => {
    if (/from final_approver_locations m/.test(text)) {
      const profile = profiles.get(mappings.get(params[0]));
      if (!profile || profile.role !== "admin" || !profile.is_active) return [];
      return [{ id: profile.id }];
    }
    if (/from profiles/.test(text) && /role = 'admin'/.test(text) && /id = \$1/.test(text)) {
      const profile = profiles.get(params[0]);
      if (!profile || profile.role !== "admin" || !profile.is_active) return [];
      return [{ id: profile.id, email: profile.email }];
    }
    if (/from logistics_approver_locations l/.test(text) && /p\.role = 'logistics_approver'/.test(text)) {
      if (params[0] === "Jafurah") return [{ profile_id: logistics }];
      if (["Rigmove", "Rental", "Transport"].includes(params[0])) {
        return [{ profile_id: otherLogistics }];
      }
      if ([
        "Dhahran Base",
        "Central Workshop",
        "RMD Salasil Workshop",
        "PCD",
        "Procurement",
        "HR",
        "Finance",
        "Warehouse",
        "SCC",
        "Safety",
      ].includes(params[0])) {
        return [{ profile_id: logistics }];
      }
      return [];
    }
    if (/from logistics_approver_locations/.test(text) && /where profile_id = \$1/.test(text)) {
      if (params[0] === logistics) return [
        { location: "Jafurah" },
        { location: "Dhahran Base" },
        { location: "Central Workshop" },
        { location: "RMD Salasil Workshop" },
        { location: "PCD" },
        { location: "Procurement" },
        { location: "HR" },
        { location: "Finance" },
        { location: "Warehouse" },
        { location: "SCC" },
        { location: "Safety" },
      ];
      if (params[0] === otherLogistics) return [
        { location: "Rigmove" },
        { location: "Rental" },
        { location: "Transport" },
      ];
      return [];
    }
    if (/insert into authorizations/.test(text)) {
      const id = `00000000-0000-4000-8000-${String(authorizations.length + 1).padStart(12, "0")}`;
      authorizations.push({
        id,
        approver_id: params[2],
        location: params[9],
        status: "pending",
        approval_stage: 1,
        vehicle_id: params[0],
        employee_id: params[1],
        start_date: params[3],
        end_date: params[4],
      });
      return [{ id, public_token: `token-${id}` }];
    }
    if (/update authorizations/.test(text)) {
      const row = authorizations.find((item) => item.id === params[0]);
      if (!row || row.status !== "pending") return [];
      if (/approval_stage = 2/.test(text)) {
        if (row.approval_stage !== 1) return [];
        row.approval_stage = 2;
        return [row];
      }
      if (/status = 'approved'/.test(text)) {
        if (row.approval_stage !== 2 || row.approver_id !== params[1]) return [];
        row.status = "approved";
        return [row];
      }
      if (/status = 'rejected'/.test(text)) {
        const stage = params[4];
        if (row.approval_stage !== stage) return [];
        if (stage === 2 && row.approver_id !== params[1]) return [];
        row.status = "rejected";
        return [row];
      }
      return [];
    }
    if (/from authorizations a/.test(text) && /approval_stage =/.test(text)) {
      return authorizations.filter((row) => {
        if (row.status !== "pending") return false;
        const stageMatch = text.match(/approval_stage = \$(\d+)/);
        if (stageMatch && row.approval_stage !== params[Number(stageMatch[1]) - 1]) return false;
        const approverMatch = text.match(/approver_id = \$(\d+)/);
        if (approverMatch && row.approver_id !== params[Number(approverMatch[1]) - 1]) return false;
        const locationMatch = text.match(/location = any\(\$(\d+)/);
        if (locationMatch && !params[Number(locationMatch[1]) - 1].includes(row.location)) return false;
        return true;
      });
    }
    if (/status in \('approved', 'rejected'/.test(text)) {
      return authorizations.filter((row) => {
        if (row.status === "pending") return false;
        const approverMatch = text.match(/approver_id = \$(\d+)/);
        if (approverMatch && row.approver_id !== params[Number(approverMatch[1]) - 1]) return false;
        const locationMatch = text.match(/location = any\(\$(\d+)/);
        if (locationMatch && !params[Number(locationMatch[1]) - 1].includes(row.location)) return false;
        return true;
      });
    }
    if (/where a\.id = \$1/.test(text) || /where id = \$1/.test(text)) {
      const row = authorizations.find((item) => item.id === params[0]);
      if (!row) return [];
      if (/approver_id =/.test(text) && row.approver_id !== params[params.length - 1] && params.length > 1) {
        const approverMatch = text.match(/approver_id = \$(\d+)/);
        if (approverMatch && row.approver_id !== params[Number(approverMatch[1]) - 1]) return [];
      }
      return [row];
    }
    return [];
  },
  queryOne: async (text, params) => one(await adapter.query(text, params)),
  execute: async () => 0,
  getPool: () => { throw new Error("Unexpected pool"); },
  isOverlapViolation: () => false,
};

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const loaded = { exports: {} };
  cache.set(file, loaded.exports);
  const require = (name) => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/db/queries") return load("lib/db/queries.ts");
    if (name === "@/lib/auth/guards") return { requireRole: async () => actor };
    if (name === "@/lib/auth/approver") return { getDefaultApproverId: async () => { throw new Error("default approver used"); } };
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async () => ({ allowed: true }),
      refundSuccessfulAttempt: async () => {},
      SAFE_REQUEST_ERROR: "Safe request error",
      TOO_MANY_ATTEMPTS: "Rate limited",
    };
    if (name === "@/lib/notifications/approval-email") return {
      notifyApprovalEvent: async (input) => {
        for (const id of input.recipientIds) {
          notifications.push({ ...input, user_id: id });
          const profile = profiles.get(id);
          if (profile) emails.push({ event: input.event, to: profile.email });
        }
      },
    };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name === "next/navigation") return { notFound() { throw Object.assign(new Error("Not found"), { code: 404 }); } };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(source(stem));
      const resolved = [stem + ".ts", stem + ".tsx", stem + "/index.ts"].find((p) => existsSync(path.join(root, p)));
      assert.ok(resolved, name);
      return load(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(
    ts.transpileModule(source(file), {
      fileName: file,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText,
    { module: loaded, exports: loaded.exports, require, console, Buffer, URL, process: { env: {} } },
    { filename: file },
  );
  cache.set(file, loaded.exports);
  return loaded.exports;
}

const queries = load("lib/db/queries.ts");
const publicActions = load("actions/public-requests.ts");
const approvals = load("actions/approvals.ts");

const employee = {
  id: "11111111-1111-4111-8111-111111111111",
  badge: "0001",
  full_name: "Synthetic Employee",
  department: null,
  position: null,
  role: "other_employee",
  national_id: "1234567890",
};
const originalGetEmployee = queries.getEmployeeForVerify;
queries.getEmployeeForVerify = async () => employee;
queries.getEmployeeByBadge = async () => employee;
queries.getVehicleById = async () => ({
  id: "22222222-2222-4222-8222-222222222222",
  is_active: true,
  plate_number: "TEST",
});
queries.getLastLimitRequestAt = async () => null;
queries.insertNotification = async () => {};
queries.listAuthorizationsByEmployeeId = async () => [];
void originalGetEmployee;

function request(location) {
  return {
    employee_id: employee.id,
    id_last4: "7890",
    vehicle_id: "22222222-2222-4222-8222-222222222222",
    start_date: "2030-01-10",
    end_date: "2030-01-11",
    duration_label: "1 day",
    contact_mobile: "0555555555",
    location,
    justification: "Synthetic business transport purpose",
    purpose: "Synthetic business transport purpose",
  };
}

resetData();
for (const [location, expected] of [
  ["Rigmove", abdullah],
  ["Rental", abdullah],
  ["Transport", abdullah],
  ["Dhahran Base", muteb],
  ["Central Workshop", muteb],
  ["RMD Salasil Workshop", muteb],
  ["PCD", muteb],
  ["Procurement", muteb],
  ["HR", muteb],
  ["Finance", muteb],
  ["Warehouse", muteb],
  ["SCC", muteb],
  ["Safety", muteb],
]) {
  const result = await publicActions.submitPublicRequest(request(location));
  assert.equal(result.ok, true, location);
  const row = authorizations.at(-1);
  assert.equal(row.approver_id, expected, location);
  assert.equal(row.approval_stage, 1);
}

assert.equal(authorizations.length, 13);
assert.ok(notifications.every((item) => item.event === "request_submitted"));
assert.ok(!emails.some((item) => item.event === "ready_for_final_approval"));

const rigmove = authorizations.find((row) => row.location === "Rigmove");
const dhahran = authorizations.find((row) => row.location === "Dhahran Base");
rigmove.approval_stage = 2;
dhahran.approval_stage = 2;
actor = { id: muteb, role: "admin" };
const mutebDenied = await approvals.approveAuthorization({ id: rigmove.id });
assert.equal(mutebDenied.ok, false);
assert.equal(mutebDenied.error, intended.FINAL_APPROVER_FORBIDDEN);
assert.equal((await approvals.rejectAuthorization({ id: rigmove.id, rejection_reason: "Not assigned" })).error, intended.FINAL_APPROVER_FORBIDDEN);
assert.equal(rigmove.status, "pending");
actor = { id: abdullah, role: "admin" };
assert.equal((await approvals.approveAuthorization({ id: dhahran.id })).error, intended.FINAL_APPROVER_FORBIDDEN);
assert.equal((await approvals.rejectAuthorization({ id: dhahran.id, rejection_reason: "Not assigned" })).error, intended.FINAL_APPROVER_FORBIDDEN);
assert.equal(dhahran.status, "pending");
rigmove.status = "approved";
const abdullahHistory = await queries.listHistoryAuthorizations(300, undefined, abdullah);
const mutebHistory = await queries.listHistoryAuthorizations(300, undefined, muteb);
assert.deepEqual(abdullahHistory.map((row) => row.id), [rigmove.id]);
assert.equal(mutebHistory.length, 0);
assert.deepEqual(
  (await queries.listPendingAuthorizations(200, { stage: 2, approverId: muteb })).map((row) => row.id),
  [dhahran.id],
);
assert.equal(
  (await queries.listPendingAuthorizations(200, { stage: 2, approverId: abdullah })).length,
  0,
);

resetData();
mappings.delete("Dhahran Base");
const missing = await publicActions.submitPublicRequest(request("Dhahran Base"));
assert.equal(missing.ok, false);
assert.equal(authorizations.length, 0);
assert.equal(notifications.length, 0);
assert.equal(emails.length, 0);

resetData();
profiles.get(muteb).is_active = false;
const inactive = await publicActions.submitPublicRequest(request("Dhahran Base"));
assert.equal(inactive.ok, false);
assert.equal(authorizations.length, 0);

resetData();
profiles.get(muteb).role = "logistics_approver";
const wrongRole = await publicActions.submitPublicRequest(request("Dhahran Base"));
assert.equal(wrongRole.ok, false);
assert.equal(authorizations.length, 0);

resetData();
const mapped = await queries.getEligibleFinalApproverIdForLocation("Rigmove");
assert.equal(mapped, abdullah);
assert.equal(await queries.getEligibleFinalApproverIdForLocation("Dhahran Base"), muteb);
assert.equal(await queries.getEligibleFinalApproverIdForLocation("Unknown"), null);

console.log("final-approver-routing: PASS");
