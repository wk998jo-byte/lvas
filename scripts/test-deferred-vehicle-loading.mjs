/**
 * Actual actions and page with synthetic adapters: no database, mail or business
 * records are accessed. Optional --url=... checks real built anonymous HTML/RSC.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const employee = {
  id: "11111111-1111-4111-8111-111111111111", badge: "555555",
  national_id: "9999991234", full_name: "Synthetic Employee",
  department: "Synthetic", position: "Synthetic", role: "other_employee",
};
const vehicle = {
  id: "22222222-2222-4222-8222-222222222222", door_number: "TEST-VEHICLE",
  plate_number: "TEST-PLATE", make: "Synthetic", model: "Test",
  year: 2025, color: "White",
};
let vehicleReads = 0;
let employeeReads = 0;
let allowed = true;
let vehicleFailure = false;
const events = [];
const inserts = [];
const notices = [];
const queries = {
  getEmployeeByBadge: async badge => {
    employeeReads++;
    events.push("identity");
    return badge === employee.badge ? employee : null;
  },
  listActiveVehicles: async () => {
    vehicleReads++;
    events.push("vehicles");
    if (vehicleFailure) throw new Error("PRIVATE DATABASE ERROR");
    return [vehicle];
  },
  getEligibleFinalApproverIdForLocation: async location => {
    events.push(`final:${location}`);
    return "33333333-3333-4333-8333-333333333333";
  },
  listLogisticsApproverIdsForLocation: async location => {
    events.push(`logistics:${location}`);
    return ["44444444-4444-4444-8444-444444444444"];
  },
  getLastLimitRequestAt: async () => null,
  getVehicleById: async id => id === vehicle.id ? { ...vehicle, is_active: true } : null,
  insertAuthorization: async data => {
    inserts.push(data);
    return { id: "66666666-6666-4666-8666-666666666666", public_token: "synthetic-token" };
  },
};
const modules = new Map();
function load(relative) {
  if (modules.has(relative)) return modules.get(relative);
  const cjs = { exports: {} };
  const require = name => {
    if (name === "@/lib/db/queries") return queries;
    if (name === "@/lib/db/pool") return { isOverlapViolation: () => false };
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async budget => {
        events.push(`budget:${budget}`);
        return { allowed };
      },
      refundSuccessfulAttempt: async () => events.push("verified"),
      SAFE_REQUEST_ERROR: "Safe request error",
      TOO_MANY_ATTEMPTS: "Too many attempts",
    };
    if (name === "@/lib/notifications/approval-email") return {
      notifyApprovalEvent: async data => notices.push(data),
    };
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name === "@/lib/i18n/server") return {
      getI18n: async () => ({
        locale: "en",
        t: load("lib/i18n/dictionaries/index.ts").getDictionary("en"),
      }),
    };
    if (name === "@/components/public/public-request-form") return {
      PublicRequestForm: props => {
        assert.equal(Object.hasOwn(props, "vehicles"), false);
        return null;
      },
    };
    if (name.startsWith("@/")) {
      const stem = path.join(root, name.slice(2));
      if (stem.endsWith(".json")) return JSON.parse(readFileSync(stem, "utf8"));
      const target = [stem + ".ts", stem + ".tsx", stem + "/index.ts"].find(existsSync);
      assert.ok(target, `Missing ${name}`);
      return load(path.relative(root, target));
    }
    return nativeRequire(name);
  };
  const compiled = ts.transpileModule(readFileSync(path.join(root, relative), "utf8"), {
    fileName: relative,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(compiled, {
    module: cjs, exports: cjs.exports, require, process: { env: {} },
    Date, console,
  }, { filename: relative });
  modules.set(relative, cjs.exports);
  return cjs.exports;
}

const actions = load("actions/public-requests.ts");
const page = load("app/(public)/request/page.tsx");
const html = renderToStaticMarkup(await page.default());
assert.equal(vehicleReads, 0, "Anonymous page must not query vehicles");
assert.equal(employeeReads, 0, "Anonymous page must not query identities");
assert.ok(!html.includes(vehicle.id) && !html.includes(vehicle.plate_number));

for (const input of [
  {}, { badge: employee.badge, id_last4: "12" },
  { badge: "unknown", id_last4: "1234" },
  { badge: employee.badge, id_last4: "9999" },
]) {
  const result = await actions.verifyEmployeeForRequest(input);
  assert.equal(result.ok, false);
  assert.equal("data" in result, false, "Failed verification leaks no employee/options");
  assert.equal(vehicleReads, 0);
}
allowed = false;
assert.equal((await actions.verifyEmployeeForRequest({
  badge: employee.badge, id_last4: "1234",
})).ok, false);
assert.equal(vehicleReads, 0, "Rate-limited identity must not load options");
allowed = true;
events.length = 0;
const result = await actions.verifyEmployeeForRequest({
  badge: employee.badge, id_last4: "1234",
});
assert.equal(result.ok, true);
assert.equal(result.data.employee.full_name, employee.full_name);
assert.equal(result.data.vehicles[0].id, vehicle.id);
assert.equal("national_id" in result.data.employee, false);
assert.deepEqual(events, [
  "budget:identityNetwork", "identity", "budget:identity", "verified", "vehicles",
]);
assert.equal(vehicleReads, 1);
vehicleFailure = true;
const failedLoad = await actions.verifyEmployeeForRequest({
  badge: employee.badge, id_last4: "1234",
});
assert.equal(failedLoad.ok, false);
assert.equal(failedLoad.error, "Safe request error");
assert.equal("data" in failedLoad, false);
vehicleFailure = false;

const { saudiTodayIsoDate } = load("lib/business-date.ts");
const { PROJECT_LOCATIONS } = load("lib/approvals/logistics-team.ts");
for (const extended of [false, true]) {
  const response = await actions.submitPublicRequest({
    badge: employee.badge, id_last4: "1234", vehicle_id: result.data.vehicles[0].id,
    start_date: saudiTodayIsoDate(), end_date: saudiTodayIsoDate(),
    duration_label: "One day", purpose: "", contact_mobile: "0500000000",
    location: PROJECT_LOCATIONS[0], justification: "Synthetic regression test only",
    extended_hours: extended,
  });
  assert.equal(response.ok, true, JSON.stringify(response));
  const inserted = inserts.at(-1);
  assert.equal(inserted.vehicle_id, vehicle.id);
  assert.equal(inserted.employee_id, employee.id);
  assert.equal(inserted.approver_id, "33333333-3333-4333-8333-333333333333");
  assert.equal(inserted.usage_after, "19:00:00");
  assert.equal(inserted.usage_until, extended ? "21:00:00" : null);
  assert.equal(notices.at(-1).recipientIds[0], "44444444-4444-4444-8444-444444444444");
  assert.ok(events.includes(`final:${PROJECT_LOCATIONS[0]}`));
  assert.ok(events.includes(`logistics:${PROJECT_LOCATIONS[0]}`));
}
const beforeInvalidSubmit = inserts.length;
assert.equal((await actions.submitPublicRequest({
  badge: employee.badge, id_last4: "9999", vehicle_id: vehicle.id,
  start_date: saudiTodayIsoDate(), end_date: saudiTodayIsoDate(),
  duration_label: "One day", purpose: "",
  contact_mobile: "0500000000", location: PROJECT_LOCATIONS[0],
  justification: "Synthetic regression test only", extended_hours: false,
})).ok, false);
assert.equal(inserts.length, beforeInvalidSubmit, "Submission still requires identity");

const target = process.argv.find(arg => arg.startsWith("--url="))?.slice(6);
if (target) {
  const response = await fetch(new URL("/request", target));
  assert.equal(response.status, 200);
  const body = await response.text();
  const flight = [...body.matchAll(/self\.__next_f\.push\((.*?)\)<\/script>/gs)]
    .map(match => JSON.parse(match[1]))
    .filter(entry => typeof entry[1] === "string")
    .map(entry => entry[1]).join("");
  assert.ok(!/"vehicles"\s*:/.test(flight), "Built Flight must not contain vehicle props");
  assert.ok(!/"plate_number"\s*:/.test(flight), "Built Flight must not contain vehicle rows");
  assert.ok(!/"door_number"\s*:/.test(flight), "Built Flight must not contain vehicle rows");
  console.log(`Built anonymous page: ${Buffer.byteLength(body)} HTML bytes, ${Buffer.byteLength(flight)} Flight bytes; no vehicle data.`);
}
console.log("PASS: anonymous no-query/no-options, failed identity/rate limit fail closed, verified options, safe load failure, selected-vehicle standard/Extended Hours submission, routing handoff.");
