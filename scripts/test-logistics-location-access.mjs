/**
 * Exercises the real query and server-page implementations with synthetic
 * records and a read-only database adapter. Never connects to any database.
 * Usage: node scripts/test-logistics-location-access.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const originalLocations = ["Dhahran Base", "Asset Department", "Facility", "Fabshop-Salsil", "Jafurah", "MGS", "Rastanura", "Yanbu", "Zuluf"];
const fourLocations = ["Central Workshop", "RMD Salasil Workshop", "Rigmove", "Rental"];
const addedLocations = ["Transport", "PCD", "Procurement", "HR", "Finance", "Warehouse", "SCC", "Safety"];
const locations = [...originalLocations, ...fourLocations, ...addedLocations];
const retiredFabshop = ["Fabshop", "Salasil"].join("-");
const retiredDepartment = ["Dhahran Base", "Asset Department"].join("-");
const mutebId = "synthetic-profile";
const abdullahId = "abdullah-admin";
const rows = locations.map((location, index) => ({
  id: `request-${index}`, location, status: "approved", approval_stage: 2,
  vehicle_id: location, start_date: "2026-10-06", end_date: "2026-10-12",
  created_at: "2026-10-06", vehicles: { plate_number: location },
  authorized_to: `Employee ${location}`,
  approver_id: ["Rigmove", "Rental", "Transport"].includes(location) ? abdullahId : mutebId,
}));
rows.push({ ...rows[0], id: "legacy-null", location: null, vehicle_id: "legacy" });
rows.push({ ...rows[0], id: "legacy-fabshop", location: retiredFabshop, vehicle_id: "legacy-fabshop" });
const jafurahRow = rows.find(row => row.location === "Jafurah");
const yanbuRow = rows.find(row => row.location === "Yanbu");
rows.push({ ...jafurahRow, id: "pending-jafurah", status: "pending", approval_stage: 1, vehicle_id: "Yanbu" });
rows.push({ ...yanbuRow, id: "pending-yanbu", status: "pending", approval_stage: 1 });
let assigned = ["Jafurah"];
let role = "logistics_approver";
let failDatabase = false;
const calls = [];
const source = (file) => readFileSync(path.join(root, file), "utf8");

function select(text, params = []) {
  if (failDatabase) throw new Error("PRIVATE DATABASE CONNECTION DETAIL");
  calls.push({ text, params });
  if (/from logistics_approver_locations/.test(text)) {
    return assigned.map((location) => ({ location }));
  }
  if (/from vehicles where/.test(text)) return [{ count: "326" }];
  let result = rows.slice();
  if (/from authorizations p/.test(text)) {
    return result.filter((row) => row.status === "pending" && params[0].includes(row.id))
      .flatMap((pending) => rows.filter((row) =>
        row.status === "approved" && row.vehicle_id === pending.vehicle_id)
        .slice(0, 1).map((row) => ({ ...row, pending_id: pending.id })));
  }
  const locationMatch = text.match(/(?:a\.)?location = any\(\$(\d+)::text\[\]\)/);
  if (locationMatch) {
    const allowed = params[Number(locationMatch[1]) - 1];
    assert.ok(Array.isArray(allowed), "locations must be bound as an array");
    result = result.filter((row) => row.location !== null && allowed.includes(row.location));
  }
  const approverMatch = text.match(/(?:a\.)?approver_id = \$(\d+)/);
  if (approverMatch) {
    result = result.filter((row) => row.approver_id === params[Number(approverMatch[1]) - 1]);
  }
  if (/where a\.id = \$1/.test(text)) result = result.filter((row) => row.id === params[0]);
  if (/where a\.vehicle_id = \$1/.test(text)) result = result.filter((row) => row.vehicle_id === params[0]);
  if (/status in \('approved', 'rejected', 'expired', 'cancelled'\)/.test(text)) {
    result = result.filter((row) => row.status !== "pending");
  }
  if (/(?:a\.)?status = 'pending'/.test(text)) result = result.filter((row) => row.status === "pending");
  if (/(?:a\.)?status = 'approved'/.test(text)) result = result.filter((row) => row.status === "approved");
  const statusMatch = text.match(/where status = \$(\d+)/);
  if (statusMatch) result = result.filter((row) => row.status === params[Number(statusMatch[1]) - 1]);
  const stageMatch = text.match(/(?:a\.)?approval_stage = \$(\d+)/);
  if (stageMatch) result = result.filter((row) => row.approval_stage === params[Number(stageMatch[1]) - 1]);
  return /count\(\*\)/.test(text) ? [{ count: String(result.length) }] : result;
}

const pool = {
  query: async (text, params) => select(text, params),
  queryOne: async (text, params) => select(text, params)[0] ?? null,
  execute: () => { throw new Error("Unexpected database mutation"); },
  getPool: () => { throw new Error("Unexpected database connection"); },
};
const jsx = (type, props) => ({ type, props });
const components = new Proxy({}, { get: (_, name) => name });
const dateHelpers = {
  saudiTodayIsoDate: () => "2026-10-06",
  addCalendarDays: (_, days) => days < 0 ? "2026-07-08" : "2026-10-13",
};
let queries;
let stats;
function load(file) {
  const loaded = { exports: {} };
  const compiled = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
  }).outputText;
  const require = (name) => {
    if (name === "zod") return nativeRequire(name);
    if (name === "@/lib/approvals/logistics-team") return load("lib/approvals/logistics-team.ts");
    if (name === "@/lib/approvals/logistics-roster.json") return JSON.parse(source("lib/approvals/logistics-roster.json"));
    if (name === "@/lib/db/pool") return pool;
    if (name === "@/lib/db/queries") return queries;
    if (name === "@/lib/approvals/presentation") return load("lib/approvals/presentation.ts");
    if (name === "@/lib/dashboard/stats") return stats;
    if (name === "@/lib/vehicles/identity") return load("lib/vehicles/identity.ts");
    if (name === "@/lib/business-date") return dateHelpers;
    if (name === "@/lib/dates") return { inclusiveDayCount: () => 7 };
    if (name === "@/lib/auth/guards") return {
      requireRole: async (allowed) => {
        assert.deepEqual(Array.from(allowed), ["admin", "logistics_approver"]);
        return {
          id: role === "admin" ? mutebId : "synthetic-logistics",
          role,
          full_name: "Test",
          email: "test@example.invalid",
        };
      },
    };
    if (name === "@/lib/authorizations/effective-status") return { isEffectivelyApproved: (status) => status === "approved" };
    // Location fixtures have no public token; QR URL behavior has its own suite.
    if (name === "@/lib/authorizations/gate-url") return { buildGateVerificationUrl: () => null };
    if (name === "next/navigation") return {
      notFound: () => { throw Object.assign(new Error("Not found"), { code: 404 }); },
    };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
    return components;
  };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require }, { filename: file });
  return loaded.exports;
}
const team = load("lib/approvals/logistics-team.ts");
assert.deepEqual(Array.from(team.PROJECT_LOCATIONS), locations);
assert.equal(team.PROJECT_LOCATIONS.length, 21);
assert.equal(new Set(team.PROJECT_LOCATIONS).size, 21);
const validation = load("lib/validations/index.ts");
const requestInput = {
  vehicle_id: "00000000-0000-4000-8000-000000000001",
  employee_id: "00000000-0000-4000-8000-000000000002",
  id_last4: "1234", contact_mobile: "0500000000",
  purpose: "",
  start_date: "2030-01-01", end_date: "2030-01-02",
  duration_label: "2 days", justification: "Synthetic test justification",
};
for (const location of locations) {
  assert.equal(validation.publicRequestSchema.safeParse({ ...requestInput, location }).success, true);
}
for (const location of [retiredFabshop, retiredDepartment, "*", "asset department", "Asset Department ",
  "RMD Salasel Workshop", "RMD Salasil", "Rig Move", "CentralWorkshop"]) {
  assert.equal(validation.publicRequestSchema.safeParse({ ...requestInput, location }).success, false);
}
assert.ok(source("components/public/public-request-form.tsx").includes("PROJECT_LOCATIONS.map("));
const sharedNewLocations = [
  "PCD", "Procurement", "HR",
  "Finance", "Warehouse", "SCC", "Safety",
];
const targets = {
  "1444": ["Asset Department"],
  "81663": ["Dhahran Base", ...sharedNewLocations],
  "11220": ["Dhahran Base", ...sharedNewLocations],
  "9146": ["Facility"],
  "81337": ["Fabshop-Salsil"],
  "11027": ["Jafurah"],
  "8627": ["MGS"],
  "8970": ["Rastanura"],
  "81339": ["Yanbu"],
  "81386": ["Zuluf"],
  "81732": ["Yanbu"],
  "8974": ["Central Workshop"],
  "8701": ["RMD Salasil Workshop"],
  "11124": ["Rigmove", "Transport"],
  "1685": ["Rental"],
};
for (const [badge, expected] of Object.entries(targets)) {
  assert.deepEqual(Array.from(team.LOGISTICS_ROSTER.find(person => person.badge === badge).locations), expected);
}
assert.equal(
  team.LOGISTICS_ROSTER.some(person => person.email === "noorah.alshamsi@binquraya.com"),
  false,
);
const haroon = team.LOGISTICS_ROSTER.find(
  person => person.email === "haroon.rasheed@binquraya.com",
);
assert.ok(haroon);
assert.deepEqual(Array.from(haroon.locations), ["Facility"]);

for (const location of fourLocations) {
  assert.equal(
    team.LOGISTICS_ROSTER.filter(person => person.locations.includes(location)).length,
    1,
  );
}
for (const location of addedLocations) {
  assert.equal(
    team.LOGISTICS_ROSTER.filter(person => person.locations.includes(location)).length,
    location === "Transport" ? 1 : 2,
  );
}
assert.ok(team.LOGISTICS_ROSTER.every(person => person.locations.every(location => locations.includes(location))));
queries = load("lib/db/queries.ts");
stats = load("lib/dashboard/stats.ts");
const history = load("app/(dashboard)/history/page.tsx").default;
const detail = load("app/(dashboard)/history/[id]/page.tsx").default;
const dashboard = load("app/(dashboard)/page.tsx").default;
function find(node, type) {
  if (!node || typeof node !== "object") return null;
  if (node.type === type) return node;
  for (const child of [].concat(node.props?.children ?? [])) {
    const result = find(child, type);
    if (result) return result;
  }
  return null;
}

// Query boundary: exact matching, all locations, no locations, and admin.
for (const scope of [...locations.map(location => [location]), locations, [], undefined, ["jafurah"], ["Jafurah "], ["Jafurah') OR TRUE --"]]) {
  const expected = rows.filter((row) =>
    row.status === "approved" && (scope === undefined || (row.location !== null && scope.includes(row.location))));
  const actual = await queries.listHistoryAuthorizations(300, scope);
  assert.deepEqual(Array.from(actual, (row) => row.id), expected.map((row) => row.id));
  for (const row of rows) {
    const actualDetail = await queries.getAuthorizationDetail(row.id, scope);
    const visible = scope === undefined || (row.location !== null && scope.includes(row.location));
    assert.equal(actualDetail?.id ?? null, visible ? row.id : null);
  }
  const expiring = await queries.listExpiringAuthorizations({ today: "2026-10-06", in7Days: "2026-10-13", locations: scope });
  assert.equal(expiring.length, expected.length);
  const insights = await queries.listInsightAuthorizations("2026-07-08", 500, scope);
  assert.ok(insights.every((row) => scope === undefined || (row.location !== null && scope.includes(row.location))));
  assert.equal(await queries.countAuthorizationsByStatus("approved", scope), expected.length);
  assert.equal(await queries.countApprovedActive("2026-10-06", scope), expected.length);
  assert.equal(await queries.countExpiringWithin("2026-10-06", "2026-10-13", scope), expected.length);
  const kpis = await stats.getDashboardKpis(scope);
  assert.equal(kpis.activeAuthorizations, expected.length);
  assert.equal(kpis.expiringWithin7Days, expected.length);
  assert.equal(kpis.fleetVehicles, 326, "fleet count remains explicitly global");
}

// Real server pages enforce the same boundary; denied and nonexistent match.
assigned = ["Jafurah"];
assert.deepEqual(Array.from(find(await history(), "ApprovalsTable").props.requests, (row) => row.location), ["Jafurah"]);
assert.equal((await detail({ params: Promise.resolve({ id: jafurahRow.id }) })).props.request.location, "Jafurah");
for (const id of [yanbuRow.id, "legacy-null", "legacy-fabshop", "nonexistent"]) {
  await assert.rejects(detail({ params: Promise.resolve({ id }) }), (error) => error.code === 404);
}
assigned = locations;
assert.equal(find(await history(), "ApprovalsTable").props.requests.length, locations.length);
await assert.rejects(detail({ params: Promise.resolve({ id: "legacy-fabshop" }) }), (error) => error.code === 404);
assigned = [];
assert.equal(find(await history(), "ApprovalsTable").props.requests.length, 0);
await assert.rejects(detail({ params: Promise.resolve({ id: jafurahRow.id }) }), (error) => error.code === 404);
role = "admin";
const mutebHistory = rows.filter((row) =>
  row.status === "approved" && row.approver_id === mutebId);
assert.equal(find(await history(), "ApprovalsTable").props.requests.length, mutebHistory.length);
assert.equal((await detail({ params: Promise.resolve({ id: "legacy-null" }) })).props.request.id, "legacy-null");
const rigmoveRow = rows.find((row) => row.location === "Rigmove");
await assert.rejects(detail({ params: Promise.resolve({ id: rigmoveRow.id }) }), (error) => error.code === 404);

// Stage-1 routing stays intact, without leaking cross-location overlap data.
role = "logistics_approver";
assigned = ["Jafurah"];
const queue = await queries.listPendingAuthorizations(200, { stage: 1, locations: assigned });
assert.deepEqual(Array.from(queue, (row) => row.id), ["pending-jafurah"]);
assert.equal(JSON.stringify(queue[0].activeConflict), '{"restricted":true}');
const pendingPage = await detail({ params: Promise.resolve({ id: "pending-jafurah" }) });
assert.equal(JSON.stringify(pendingPage.props.actions.props.conflict), '{"restricted":true}');
const adminQueue = await queries.listPendingAuthorizations(200, { stage: 2 });
assert.equal(adminQueue.length, 0);
assert.equal((await queries.listPendingAuthorizations(200, { stage: 1, locations: [] })).length, 0);
const dashboardStart = calls.length;
await dashboard();
const dashboardCalls = calls.slice(dashboardStart).filter(({ text }) => /from authorizations/.test(text));
assert.ok(dashboardCalls.length > 0);
assert.ok(dashboardCalls.every(({ text }) => /location = any/.test(text) || /from authorizations p/.test(text)));
role = "admin";
const adminStart = calls.length;
await dashboard();
const adminAuthCalls = calls.slice(adminStart).filter(({ text }) => /from authorizations/.test(text));
assert.ok(adminAuthCalls.length > 0);
assert.ok(adminAuthCalls.every(({ text }) =>
  /approver_id =/.test(text) || /from authorizations p/.test(text)));
assert.ok(adminAuthCalls.every(({ text }) => !/location = any/.test(text)));

// Raw database errors are not included in the touched page responses.
failDatabase = true;
assert.ok(!JSON.stringify(await history()).includes("PRIVATE DATABASE"));
assert.ok(!JSON.stringify(await detail({ params: Promise.resolve({ id: jafurahRow.id }) })).includes("PRIVATE DATABASE"));
assert.ok(!source("app/(dashboard)/history/page.tsx").includes("error.message"));
assert.ok(!source("app/(dashboard)/history/[id]/page.tsx").includes("error.message"));
console.log("logistics-location-access: PASS (exact 21 locations, Noorah retired, Haroon Facility, Transport with Khalil and seven shared Waqar/Anees sites, request validation/dropdown, queries, pages, legacy denial, overlap redaction)");
