/**
 * Actual decision SQL + actual server actions and rendered UI, using synthetic
 * fixtures in a disposable LOCAL database. Never targets Development/Production.
 * Run with LVAS_DISPOSABLE_TEST_DB=1 and a localhost:15439/heliumdb DATABASE_URL.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pool } from "pg";
import ts from "typescript";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.LVAS_DISPOSABLE_TEST_DB, "1", "Explicit disposable DB opt-in required");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "15439");
assert.equal(url.pathname, "/heliumdb");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const pool = new Pool({ connectionString: url.href, max: 1 });
const db = await pool.connect();
const logId = randomUUID(), adminId = randomUUID(), requesterId = randomUUID(), employeeId = randomUUID();
let role = "logistics_approver";
let assigned = ["Jafurah"];
let notificationFailure = false, preparationFailure = false, databaseFailure = false;
let badgeSummaries = [];
const warnings = [], revalidated = [];
const cache = new Map();
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-10-06T12:00:00Z"])); }
}
async function query(text, params = []) {
  if (databaseFailure) throw new Error("PRIVATE DATABASE ERROR");
  if (notificationFailure && /insert into notifications/.test(text)) {
    throw new Error("PRIVATE NOTIFICATION ERROR");
  }
  if (preparationFailure && /from vehicles where id/.test(text)) {
    throw new Error("PRIVATE VEHICLE QUERY ERROR");
  }
  return (await db.query(text, params)).rows;
}
const adapter = {
  query, queryOne: async (...args) => (await query(...args))[0] ?? null,
  execute: async (text, params) => (await db.query(text, params)).rowCount,
  getPool: () => { throw new Error("Unexpected connection outside disposable session"); },
  isOverlapViolation: () => false,
  pgErrorMessage: () => "PRIVATE DATABASE ERROR",
};
const facade = new Proxy({}, {
  get: (_, name) => function Component({ children, render, className, href, disabled, id }) {
    if (name === "DialogContent") return null; // Closed client dialogs.
    if (render) return React.cloneElement(render, { className, children });
    return React.createElement(name === "Button" ? "button" : "div",
      { className, href, disabled, id }, children);
  },
});
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const code = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  let hookIndex = 0;
  const require = (name) => {
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/auth/guards") return { requireRole: async () => ({ id: role === "admin" ? adminId : logId, role, full_name: "Synthetic staff", email: "test@example.invalid" }) };
    if (name === "@/lib/auth/approver") return { getDefaultApproverId: async () => adminId };
    if (name === "@/lib/security/rate-limit") return { consumeRateLimit: async () => ({ allowed: true }) };
    if (name === "next/cache") return { revalidatePath: (value) => revalidated.push(value) };
    if (name === "next/navigation") return { notFound: () => { throw Object.assign(new Error("Not found"), { code: 404 }); } };
    if (name === "next/link") return ({ href, children, className }) => React.createElement("a", { href, className }, children);
    if (name === "sonner") return { toast: { success() {}, error() {} } };
    if (name === "qrcode.react") return { QRCodeSVG: ({ value }) => React.createElement("svg", { "data-qr-value": value }) };
    if (name === "@/actions/public-requests") return { lookupRequestsByBadge: async () => { throw new Error("Unexpected lookup submission"); } };
    if (name === "react" && file === "components/public/badge-status-form.tsx") return {
      useState: () => [[ "", "", null, "Synthetic employee", badgeSummaries ][hookIndex++], () => {}],
      useTransition: () => [false, () => {}],
    };
    if (name.startsWith("@/components/ui/") || name === "@/components/brand/logo") return facade;
    if (name.startsWith("@/components/dashboard/") || name === "@/components/export/export-csv-button") return facade;
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(readFileSync(path.join(root, stem), "utf8"));
      const resolved = [stem + ".ts", stem + ".tsx", stem + "/index.ts"]
        .find(p => existsSync(path.join(root, p)));
      assert.ok(resolved, `Unresolved test import: ${name}`);
      return load(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(code, {
    module, exports: module.exports, require, Date: TestDate, URL, Buffer,
    process: { env: { APP_URL: "https://lvas.example.invalid" } },
    console: { warn: (...args) => warnings.push(args.join(" ")), error: (...args) => warnings.push(args.join(" ")) },
  }, { filename: file });
  cache.set(file, module.exports);
  return module.exports;
}
const html = (node) => renderToStaticMarkup(node);
const buttons = (markup) => [...markup.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
const decisionButtons = (markup) => buttons(markup).filter(text => text === "Approve" || text === "Reject");
async function staffDetail(id) {
  return html(await load("app/(dashboard)/history/[id]/page.tsx").default({ params: Promise.resolve({ id }) }));
}
async function publicTrack(token) {
  return html(await load("app/(public)/track/[token]/page.tsx").default({ params: Promise.resolve({ token }) }));
}
function employeeStatus(row) {
  badgeSummaries = [{
    token: row.public_token, status: row.status, approvalStage: row.approval_stage,
    reference: row.id.slice(0, 8), startDate: row.start_date, endDate: row.end_date,
    durationLabel: "One day", location: row.location, plate: "Synthetic plate",
    rejectionReason: row.rejection_reason,
  }];
  cache.delete("components/public/badge-status-form.tsx");
  return html(React.createElement(load("components/public/badge-status-form.tsx").BadgeStatusForm));
}
async function fixture(location = "Jafurah", stage = 1, withRequester = false) {
  const id = randomUUID(), vehicleId = randomUUID(), token = randomUUID();
  await db.query("insert into vehicles (id,plate_number,make,model,is_active) values ($1,$2,'Test','Car',true)", [vehicleId, `PLATE-${id.slice(0, 8)}`]);
  await db.query(`insert into authorizations
    (id,vehicle_id,employee_id,requester_id,public_token,approver_id,status,approval_stage,start_date,end_date,duration_label,usage_after,location,justification,created_at,updated_at)
    values ($1,$2,$3,$4,$5,$6,'pending',$7,'2026-10-06','2026-10-06','One day','19:00',$8,'Synthetic purpose',now(),now())`,
  [id,vehicleId,employeeId,withRequester ? requesterId : null,token,adminId,stage,location]);
  return id;
}

try {
  const identity = (await db.query("select current_database() as name, current_user as role")).rows[0];
  assert.equal(identity.name, "heliumdb");
  assert.equal(identity.role, "postgres");
  await db.query("begin");
  await db.query(`
    create temp table profiles (id uuid,full_name text,email text,department text,role text,is_active boolean);
    create temp table employees (id uuid,full_name text,badge text,department text,mobile text);
    create temp table vehicles (id uuid,plate_number text,make text,model text,year integer,color text,is_active boolean,notes text,created_by uuid,created_at timestamptz,updated_at timestamptz,door_number text);
    create temp table logistics_approver_locations (profile_id uuid,location text);
    create temp table notifications (user_id uuid,authorization_id uuid,type text,title text,body text,is_read boolean,sent_at timestamptz,dedupe_key text);
    create temp table authorizations (
      id uuid,vehicle_id uuid,requester_id uuid,employee_id uuid,public_token uuid,contact_mobile text,
      approver_id uuid,status text,start_date date,end_date date,duration_label text,usage_after time,
      purpose text,rejection_reason text,location text,justification text,approval_stage integer,
      first_approver_id uuid,first_approved_at timestamptz,approved_at timestamptz,rejected_at timestamptz,
      created_at timestamptz,updated_at timestamptz);
  `);
  await db.query(`insert into profiles values
    ($1,'Logistics Test Actor','internal-logistics@example.invalid',null,'logistics_approver',true),
    ($2,'Final Test Actor','internal-admin@example.invalid',null,'admin',true),
    ($3,'Requester Test Actor','internal-requester@example.invalid',null,'other_employee',true)`, [logId,adminId,requesterId]);
  await db.query("insert into employees values ($1,'Synthetic employee','TEST-BADGE',null,null)", [employeeId]);
  await db.query("insert into logistics_approver_locations values ($1,'Jafurah')", [logId]);
  const queries = load("lib/db/queries.ts"), actions = load("actions/approvals.ts"), presentation = load("lib/approvals/presentation.ts");
  const read = (id) => queries.getAuthorizationById(id);
  const id = await fixture();
  const initial = await read(id);
  assert.deepEqual(decisionButtons(await staffDetail(id)), ["Approve", "Reject"]);
  role = "admin";
  assert.equal(decisionButtons(await staffDetail(id)).length, 0);
  assert.match(await staffDetail(id), /Waiting for Logistics approval/);
  assert.equal((await actions.approveAuthorization({ id })).ok, false);
  assert.equal((await actions.rejectAuthorization({ id, rejection_reason: "Not allowed" })).ok, false);
  for (const markup of [await publicTrack(initial.public_token), employeeStatus(initial)]) assert.match(markup, /Waiting for Logistics approval/);
  role = "logistics_approver";
  const first = await actions.approveAuthorization({ id });
  assert.equal(first.ok, true);
  assert.equal(first.data.status, "pending");
  assert.equal(first.data.approval_stage, 2);
  assert.equal(first.data.first_approver_id, logId);
  assert.ok(first.data.first_approved_at);
  assert.equal(presentation.approvalSuccessMessage(first.data), "Logistics approval recorded. Request sent for final approval.");
  const waiting = await queries.listLogisticsWaitingForFinalApproval(assigned);
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].id, id);
  assert.equal(waiting[0].first_approver.full_name, "Logistics Test Actor");
  assert.equal((await queries.listPendingAuthorizations(200, { stage: 1, locations: assigned })).length, 0);
  assert.equal((await queries.listHistoryAuthorizations(300, assigned)).length, 0);
  const waitingHtml = await staffDetail(id);
  assert.equal(decisionButtons(waitingHtml).length, 0);
  assert.match(waitingHtml, /Logistics approved — waiting for final approval/);
  assert.match(waitingHtml, /Logistics Test Actor/);
  assert.match(waitingHtml, /Saudi time/);
  assert.equal((await actions.approveAuthorization({ id })).ok, false);
  assert.equal((await actions.rejectAuthorization({ id, rejection_reason: "Not allowed" })).ok, false);
  for (const markup of [await publicTrack(initial.public_token), employeeStatus(await read(id))]) {
    assert.match(markup, /Logistics approved — waiting for final approval/);
    assert.doesNotMatch(markup, /internal-logistics|internal-admin/);
  }
  const outside = await fixture("Zuluf", 2), unlocated = await fixture(null, 2);
  assert.equal((await queries.listLogisticsWaitingForFinalApproval(["Zuluf"]))[0].id, outside);
  assert.equal((await queries.listLogisticsWaitingForFinalApproval([])).length, 0);
  assert.equal((await queries.listLogisticsWaitingForFinalApproval(["Unknown location"])).length, 0);
  assert.ok((await queries.listLogisticsWaitingForFinalApproval(assigned)).every(row => row.location === "Jafurah" && row.id !== unlocated));
  await assert.rejects(staffDetail(outside), error => error.code === 404);
  const dashboard = html(await load("app/(dashboard)/page.tsx").default());
  assert.match(dashboard, /Waiting for final approval/);
  assert.match(dashboard, new RegExp(`/history/${id}`));
  assert.doesNotMatch(dashboard, new RegExp(`/history/${outside}|/history/${unlocated}`));
  const waitingSection = dashboard.match(/<section[^>]*>(?:(?!<\/section>).)*Waiting for final approval(?:(?!<\/section>).)*<\/section>/s)[0];
  assert.equal(decisionButtons(waitingSection).length, 0);
  role = "admin";
  assert.deepEqual(decisionButtons(await staffDetail(id)), ["Approve", "Reject"]);
  assert.match(await staffDetail(id), /Logistics approved — awaiting final decision/);
  assert.match(await staffDetail(id), /Logistics Test Actor/);
  const final = await actions.approveAuthorization({ id });
  assert.equal(final.ok, true);
  assert.equal(final.data.status, "approved");
  assert.equal(final.data.first_approver_id, logId);
  assert.equal(final.data.approver_id, adminId);
  assert.ok(final.data.approved_at);
  assert.equal(presentation.approvalSuccessMessage(final.data), "Authorization approved");
  assert.equal(decisionButtons(await staffDetail(id)).length, 0);
  assert.match(await publicTrack(initial.public_token), /data-qr-value="https:\/\/lvas.example.invalid\/verify\//);

  for (const stage of [1, 2]) {
    role = "logistics_approver";
    const rejectId = await fixture("Jafurah", 1, true);
    if (stage === 2) assert.equal((await actions.approveAuthorization({ id: rejectId })).ok, true);
    role = stage === 1 ? "logistics_approver" : "admin";
    const result = await actions.rejectAuthorization({ id: rejectId, rejection_reason: "Synthetic rejection reason" });
    assert.equal(result.ok, true);
    assert.equal(result.data.status, "rejected");
    assert.equal(result.data.approval_stage, stage);
    assert.equal(result.data.approver_id, stage === 1 ? logId : adminId);
    assert.ok(result.data.rejected_at);
    const detail = await staffDetail(rejectId);
    const label = stage === 1 ? "Rejected by Logistics" : "Rejected by Final Approver";
    assert.match(detail, new RegExp(label));
    assert.match(detail, /Synthetic rejection reason/);
    assert.equal(decisionButtons(detail).length, 0);
    if (stage === 1) assert.doesNotMatch(detail, />Final approver</);
    else assert.match(detail, /Logistics Test Actor/);
    assert.match(detail, stage === 1 ? /Logistics Test Actor/ : /Final Test Actor/);
    for (const markup of [await publicTrack(result.data.public_token), employeeStatus(result.data)]) {
      assert.match(markup, new RegExp(label));
      assert.match(markup, /Synthetic rejection reason/);
      assert.doesNotMatch(markup, /internal-logistics|internal-admin|First approval/);
      assert.doesNotMatch(markup, /data-qr-value/);
    }
    assert.ok((await queries.listHistoryAuthorizations()).some(row => row.id === rejectId));
  }
  // A historical stage-2 row without first approval must not acquire an invented actor/time.
  await db.query("update authorizations set status='rejected',rejection_reason='Historical reason',rejected_at=now() where id=$1", [outside]);
  role = "admin";
  const legacyHtml = await staffDetail(outside);
  assert.doesNotMatch(legacyHtml, /Logistics Test Actor|Muteb/);
  assert.match(legacyHtml, /Historical reason/);
  for (const [actor, stage, decision] of [
    ["logistics_approver", 1, "approve"], ["admin", 2, "approve"],
    ["logistics_approver", 1, "reject"], ["admin", 2, "reject"],
  ]) {
    role = "logistics_approver";
    const target = await fixture("Jafurah", 1, true);
    if (stage === 2) assert.equal((await actions.approveAuthorization({ id: target })).ok, true);
    role = actor;
    notificationFailure = true;
    const result = decision === "approve"
      ? await actions.approveAuthorization({ id: target })
      : await actions.rejectAuthorization({ id: target, rejection_reason: "Failure-semantics reason" });
    notificationFailure = false;
    assert.equal(result.ok, true);
    const saved = await read(target);
    assert.equal(saved.status, decision === "reject" ? "rejected" : stage === 1 ? "pending" : "approved");
    assert.equal(saved.approval_stage, decision === "approve" ? 2 : stage);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|ERROR/);
  }
  role = "logistics_approver";
  const preparationId = await fixture();
  preparationFailure = true;
  assert.equal((await actions.approveAuthorization({ id: preparationId })).ok, true);
  preparationFailure = false;
  assert.equal((await read(preparationId)).approval_stage, 2);
  assert.equal(warnings.length, 5);
  assert.ok(warnings.every(message => message === "LVAS decision notification delivery failed"));
  databaseFailure = true;
  assert.doesNotMatch(JSON.stringify(await actions.approveAuthorization({ id: preparationId })), /PRIVATE/);
  assert.doesNotMatch(JSON.stringify(await actions.rejectAuthorization({ id: preparationId, rejection_reason: "Reason" })), /PRIVATE/);
  databaseFailure = false;
  assert.ok(revalidated.includes("/history"));
  assert.equal(presentation.formatDecisionTime("2026-10-06T20:30:00Z"), "06 Oct 2026, 23:30 (Saudi time)");
  assert.equal(presentation.formatDecisionTime("2026-10-06T22:30:00Z"), "07 Oct 2026, 01:30 (Saudi time)");
  assert.equal(presentation.formatDecisionTime(null), "Not recorded");
  assert.equal(presentation.formatDecisionTime("invalid"), "Not recorded");
  for (const status of ["approved", "rejected", "expired", "cancelled"]) {
    for (const actor of ["admin", "logistics_approver"]) {
      for (const stage of [1, 2]) assert.equal(presentation.canReviewApproval(actor, { status, approval_stage: stage }), false);
    }
  }
  for (const file of ["components/approvals/approval-actions.tsx", "components/approvals/approvals-table.tsx"]) {
    const text = readFileSync(path.join(root, file), "utf8");
    assert.match(text, /approvalSuccessMessage\(result.data\)/);
    assert.doesNotMatch(text, /toast.success\("Request approved"\)/);
  }
  console.log("approval-ux: PASS (A–I: real conditional SQL, role/stage UI, scoped waiting list, public wording, attribution, persisted notification-failure decisions, Saudi time)");
} finally {
  await db.query("rollback");
  db.release();
  await pool.end();
}
