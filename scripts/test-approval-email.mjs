// Actual actions, query SQL and mailer. Isolated PostgreSQL + mocked Nodemailer.
// No environment credentials, Production connection or real SMTP is used.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { Pool } from "pg";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const pool = new Pool({
  host: "127.0.0.1", port: 15439, database: "heliumdb",
  user: "postgres", password: "disposable-fixture-unused", ssl: false, max: 12,
});
const identity = (await pool.query("select current_setting('data_directory') as dir")).rows[0];
assert.equal(identity.dir, "/tmp/lvas-approval-email-pg", "Only this disposable cluster is permitted");
const schema = readFileSync(path.join(root, "db/schema.sql"), "utf8");
const ids = Object.fromEntries(["ejaz","waqar","haroon","jafurah","inactive","empty","invalid",
  "ashwin","ninju","khalil","anwin",
  "admin","otherAdmin","abdullah","employee","vehicle"].map(k => [k, randomUUID()]));
const fixtureEnv = {
  NODE_ENV: "production", APP_URL: "https://lvas.example.invalid",
  SMTP_HOST: "smtp.example.invalid", SMTP_FROM: "LVAS <sender@example.invalid>",
  SMTP_USER: "synthetic-user", SMTP_PASSWORD: "synthetic-secret",
};
let failSmtp = false, notificationFailure = false, actor = ids.ejaz;
const attempts = [], transports = [], warnings = [], cache = new Map();
const query = async (text, params=[]) => {
  if (notificationFailure && /insert into notifications/i.test(text)) throw new Error("PRIVATE DATABASE DETAILS");
  return (await pool.query(text,params)).rows;
};
const adapter = {
  query, queryOne: async (...args) => (await query(...args))[0] ?? null,
  execute: async (text,params) => (await pool.query(text,params)).rowCount,
  getPool: () => pool,
  isOverlapViolation: () => false,
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const sandboxModule = { exports: {} };
  cache.set(file,sandboxModule.exports);
  const code = ts.transpileModule(readFileSync(path.join(root,file),"utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const require = name => {
    if (name === "nodemailer") return {
      createTransport: options => {
        transports.push(options);
        return { sendMail: async message => {
          attempts.push(message);
          if (failSmtp) throw new Error("PRIVATE SMTP AUTH synthetic-secret RESET PRIVATE-TOKEN");
        } };
      },
    };
    if (name === "@/lib/db/pool") return adapter;
    if (name === "@/lib/auth/guards") return {
      requireRole: async () => ({ id: actor, role: "logistics_approver" }),
    };
    if (name === "@/lib/auth/approver") return { getDefaultApproverId: async () => ids.admin };
    if (name === "@/lib/security/rate-limit") return {
      consumeRateLimit: async () => ({ allowed: true }),
      refundSuccessfulAttempt: async () => {},
      SAFE_REQUEST_ERROR: "Safe request error", TOO_MANY_ATTEMPTS: "Rate limited",
    };
    if (name === "next/cache") return { revalidatePath() {} };
    if (name === "next/headers") return {
      headers: async () => new Headers({ host: "untrusted.example.invalid" }),
      cookies: async () => ({ get: () => undefined, set() {} }),
    };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(readFileSync(path.join(root,stem),"utf8"));
      const resolved = [stem+".ts",stem+".tsx",stem+"/index.ts"].find(p=>existsSync(path.join(root,p)));
      assert(resolved, "Unresolved import "+name);
      return load(resolved);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(code, {
    module: sandboxModule, exports: sandboxModule.exports, require, URL, Headers, Buffer, Date,
    process: { env: fixtureEnv },
    console: {
      warn: (...args) => warnings.push(JSON.stringify(args)),
      error: (...args) => warnings.push(JSON.stringify(args)),
    },
  }, { filename:file });
  cache.set(file,sandboxModule.exports);
  return sandboxModule.exports;
}
async function reset() {
  await pool.query("drop schema public cascade; create schema public");
  await pool.query(schema);
  for (const name of ["ejaz","waqar","haroon","jafurah","inactive","empty","invalid","admin","otherAdmin",
    "abdullah","ashwin","ninju","khalil","anwin"]) {
    await pool.query(`insert into profiles(id,full_name,email,role,is_active)
      values($1,$2,$3,$4,$5)`,[
      ids[name],"Synthetic "+name,
      name==="empty" ? "" : name==="invalid" ? "not-an-email" : name+"@example.invalid",
      ["admin","otherAdmin","abdullah"].includes(name) ? "admin" : "logistics_approver",
      name!=="inactive",
    ]);
  }
  const sharedAdded = ["Transport","PCD","Procurement","HR","Finance","Warehouse","SCC","Safety"];
  for (const [name,locations] of Object.entries({
    ejaz:["Dhahran Base", ...sharedAdded],
    waqar:["Dhahran Base", ...sharedAdded],
    haroon:["Facility"],
    jafurah:["Jafurah"],
    inactive:["Dhahran Base"],
    empty:["Facility"],
    invalid:["Facility"],
    ashwin:["Central Workshop"],
    ninju:["RMD Salasil Workshop"],
    khalil:["Rigmove"],
    anwin:["Rental"],
  })) {
    for (const location of locations) await pool.query(
      "insert into logistics_approver_locations(profile_id,location) values($1,$2)",[ids[name],location],
    );
  }
  const team = load("lib/approvals/logistics-team.ts");
  const intended = load("lib/approvals/final-approvers.ts");
  for (const location of team.PROJECT_LOCATIONS) {
    await pool.query(
      "insert into final_approver_locations(location,profile_id) values($1,$2)",
      [location, intended.ABDULLAH_FINAL_LOCATIONS.includes(location) ? ids.abdullah : ids.admin],
    );
  }
  await pool.query(`insert into employees(id,badge,full_name,national_id,role)
    values($1,'TEST-123','Synthetic Employee','1234567890','other_employee')`,[ids.employee]);
  await pool.query(`insert into vehicles(id,door_number,plate_number,make,model)
    values($1,'006-01-TEST',null,'Toyota','Synthetic Model')`,[ids.vehicle]);
  attempts.length=transports.length=warnings.length=0;
  failSmtp=notificationFailure=false;
  actor=ids.ejaz;
  fixtureEnv.APP_URL="https://lvas.example.invalid";
  delete fixtureEnv.SMTP_PORT;
}
const events=load("lib/notifications/approval-email.ts");
const actions=load("actions/public-requests.ts");
const approvals=load("actions/approvals.ts");
const mail=load("lib/auth/mail.ts");
const auth=load("actions/auth.ts");
const input=location=>({
  employee_id:ids.employee,id_last4:"7890",vehicle_id:ids.vehicle,
  start_date:"2030-01-10",end_date:"2030-01-11",duration_label:"1 day",
  contact_mobile:"0555555555",location,purpose:"Synthetic business transport purpose",
  justification:"Synthetic business transport purpose",
});
async function submit(location="Dhahran Base") {
  const result=await actions.submitPublicRequest(input(location));
  assert.equal(result.ok,true,JSON.stringify(result));
  return (await pool.query("select id from authorizations order by created_at desc limit 1")).rows[0].id;
}
const eventInput=(id,recipientIds=[ids.ejaz])=>({
  authorizationId:id,event:"request_submitted",recipientIds,
  title:"New authorization request",body:"Synthetic event",
});
const notificationCount=async()=>Number((await pool.query("select count(*) from notifications")).rows[0].count);
let passed=0;
async function test(name,fn) {
  await reset();
  await fn();
  passed++;
  console.log("PASS: "+name);
}
try {
  await test("Existing single-site locations use exact assigned recipients",async()=>{
    for (const [location,name] of [
      ["Central Workshop","ashwin"],["RMD Salasil Workshop","ninju"],
      ["Rigmove","khalil"],["Rental","anwin"],
    ]) {
      // Each site is an independent scenario. Reusing this employee for several
      // requests would correctly hit the real daily submission cooldown.
      await reset();
      attempts.length=0;
      const id=await submit(location);
      assert.deepEqual(attempts.map(m=>m.to),[name+"@example.invalid"]);
      const recipients=(await pool.query(
        "select user_id from notifications where authorization_id=$1",[id])).rows;
      assert.deepEqual(recipients.map(r=>r.user_id),[ids[name]]);
      attempts.length=0;
      actor=ids[name];
      assert.equal((await approvals.approveAuthorization({id})).ok,true);
      const expectedFinal = ["Rigmove","Rental"].includes(location)
        ? "abdullah@example.invalid" : "admin@example.invalid";
      assert.deepEqual(attempts.map(m=>m.to),[expectedFinal]);
      assert.equal((await pool.query("select approval_stage,approver_id from authorizations where id=$1",[id])).rows[0].approval_stage,2);
      assert.equal((await pool.query("select approver_id from authorizations where id=$1",[id])).rows[0].approver_id,
        ["Rigmove","Rental"].includes(location) ? ids.abdullah : ids.admin);
    }
    // Runtime reassignment, without changing the roster or mailer, changes routing.
    await reset();
    await pool.query("update logistics_approver_locations set profile_id=$1 where location=$2",
      [ids.waqar,"Central Workshop"]);
    attempts.length=0;
    await submit("Central Workshop");
    assert.deepEqual(attempts.map(m=>m.to),["waqar@example.invalid"]);
  });
  await test("Eight added locations notify Waqar and Anees; Transport final routes to Abdullah",async()=>{
    for (const location of ["Transport","PCD","Procurement","HR","Finance","Warehouse","SCC","Safety"]) {
      await reset();
      attempts.length=0;

      const id=await submit(location);

      assert.deepEqual(
        attempts.map(m=>m.to).sort(),
        ["ejaz@example.invalid","waqar@example.invalid"],
        location,
      );

      attempts.length=0;
      actor=ids.ejaz;

      const approved=await approvals.approveAuthorization({id});
      assert.equal(approved.ok,true,location);

      const expectedFinal =
        location === "Transport"
          ? "abdullah@example.invalid"
          : "admin@example.invalid";

      assert.deepEqual(attempts.map(m=>m.to),[expectedFinal],location);

      const row=(await pool.query(
        "select approval_stage,approver_id from authorizations where id=$1",
        [id],
      )).rows[0];

      assert.equal(row.approval_stage,2,location);
      assert.equal(
        row.approver_id,
        location === "Transport" ? ids.abdullah : ids.admin,
        location,
      );
    }
  });

  await test("Independent site fixtures do not weaken the real employee submission cooldown",async()=>{
    await submit("Central Workshop");
    const before=(await pool.query("select count(*)::int n from authorizations")).rows[0].n;
    const second=await actions.submitPublicRequest(input("Rental"));
    assert.equal(second.ok,false);
    assert.match(second.error,/next request is available/i);
    assert.equal((await pool.query("select count(*)::int n from authorizations")).rows[0].n,before);
    assert.deepEqual(attempts.map(m=>m.to),["ashwin@example.invalid"]);
  });
  await test("Dhahran selects exactly assigned active Logistics recipients; business content and protected links",async()=>{
    const id=await submit();
    assert.deepEqual(attempts.map(m=>m.to).sort(),["ejaz@example.invalid","waqar@example.invalid"]);
    assert.equal(await notificationCount(),2);
    for (const m of attempts) {
      assert.equal(m.subject,"LVAS – New Vehicle Authorization Request");
      for(const value of ["Synthetic Employee","TEST-123","006-01-TEST","Toyota Synthetic Model",
        "Dhahran Base","2030-01-10","2030-01-11","Synthetic business transport purpose",
        `https://lvas.example.invalid/history/${id}`]) assert(m.text.includes(value),value);
      assert(!m.text.includes("/track/")&&!m.text.includes("/reset-password/"));
      const token=(await pool.query("select public_token from authorizations where id=$1",[id])).rows[0].public_token;
      assert(!m.text.includes(token));
    }
    assert.equal(transports[0].host,"smtp.example.invalid");
    assert.equal(transports[0].socketTimeout,10000);
  });
  await test("Jafurah selects only assigned recipients",async()=>{
    await submit("Jafurah");
    assert.deepEqual(attempts.map(m=>m.to).sort(),["jafurah@example.invalid"]);
  });
  await test("Unassigned location cannot route globally or create a request",async()=>{
    const result=await actions.submitPublicRequest(input("MGS"));
    assert.equal(result.ok,false);
    assert.equal(attempts.length,0);
    assert.equal(Number((await pool.query("select count(*) from authorizations")).rows[0].count),0);
  });
  await test("Existing event retry creates no duplicate notification/email",async()=>{
    const id=await submit();
    await events.notifyApprovalEvent(eventInput(id,[ids.ejaz,ids.waqar]));
    assert.equal(attempts.length,2); assert.equal(await notificationCount(),2);
  });
  await test("Real unique index arbitrates 20 concurrent identical events",async()=>{
    const id=await submit();
    await pool.query("delete from notifications"); attempts.length=0;
    await Promise.all(Array.from({length:20},()=>events.notifyApprovalEvent(eventInput(id))));
    assert.equal(attempts.length,1); assert.equal(await notificationCount(),1);
  });
  await test("Stage transition emails exact stored Admin, never other Admins; no decision retry email",async()=>{
    const id=await submit(); attempts.length=0;
    await pool.query("update authorizations set approver_id=$2 where id=$1",[id,ids.otherAdmin]);
    const result=await approvals.approveAuthorization({id});
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.data.approval_stage,2); assert.equal(result.data.status,"pending");
    assert.deepEqual(attempts.map(m=>m.to),["otherAdmin@example.invalid"]);
    assert.equal(attempts[0].subject,"LVAS – Request Ready for Final Approval");
    assert(attempts[0].text.includes("Synthetic ejaz"));
    assert(attempts[0].text.includes("Logistics approval time:"));
    const retry=await approvals.approveAuthorization({id});
    assert.equal(retry.ok,false); assert.equal(attempts.length,1);
  });
  await test("SMTP failure leaves request creation successful, notifications retained and no repeat attempt",async()=>{
    failSmtp=true;
    const id=await submit();
    assert.equal(attempts.length,2); assert.equal(await notificationCount(),2);
    await events.notifyApprovalEvent(eventInput(id,[ids.ejaz,ids.waqar]));
    assert.equal(attempts.length,2);
    assert.equal((await pool.query("select status from authorizations where id=$1",[id])).rows[0].status,"pending");
    assert(!warnings.join("").includes("synthetic-secret"));
    assert(!warnings.join("").includes("PRIVATE SMTP"));
    assert(warnings.some(w=>w.includes("email_attempt_failed")));
  });
  await test("SMTP failure leaves Logistics approval committed and in-app notification retained",async()=>{
    const id=await submit(); attempts.length=0; failSmtp=true;
    assert.equal((await approvals.approveAuthorization({id})).ok,true);
    const a=(await pool.query("select approval_stage,status from authorizations where id=$1",[id])).rows[0];
    assert.equal(a.approval_stage,2); assert.equal(a.status,"pending");
    assert.equal(attempts.length,1); assert.equal(await notificationCount(),3);
  });
  await test("Historical stage-2 request is not automatically emailed or reapproved",async()=>{
    const historical="aa495f6b-91d9-4eef-b1e2-6b32eb82714a";
    await pool.query(`insert into authorizations(id,vehicle_id,employee_id,approver_id,
      status,approval_stage,start_date,end_date,duration_label,location)
      values($1,$2,$3,$4,'pending',2,'2030-01-10','2030-01-11','1 day','Dhahran Base')`,
      [historical,ids.vehicle,ids.employee,ids.admin]);
    assert.equal(attempts.length,0);
    assert.equal((await approvals.approveAuthorization({id:historical})).ok,false);
    assert.equal(attempts.length,0); assert.equal(await notificationCount(),0);
  });
  await test("Inactive, empty, invalid-email and unassigned recipients are safely skipped",async()=>{
    const id=await submit("Facility");
    assert.deepEqual(attempts.map(m=>m.to),["haroon@example.invalid"]);
    await events.notifyApprovalEvent(eventInput(id,[ids.inactive,ids.jafurah]));
    assert.equal(attempts.length,1);
    assert(warnings.some(w=>w.includes("recipient_ineligible")));
  });
  await test("Wrong-role or inactive stored final Admin fails closed without advancing",async()=>{
    const id=await submit(); attempts.length=0;
    await pool.query("update authorizations set approver_id=$2 where id=$1",[id,ids.waqar]);
    assert.equal((await approvals.approveAuthorization({id})).ok,false);
    assert.equal((await pool.query("select approval_stage from authorizations where id=$1",[id])).rows[0].approval_stage,1);
    assert.equal(attempts.length,0);
    await reset();
    const second=await submit(); attempts.length=0;
    await pool.query("update profiles set is_active=false where id=$1",[ids.admin]);
    assert.equal((await approvals.approveAuthorization({id:second})).ok,false);
    assert.equal((await pool.query("select approval_stage from authorizations where id=$1",[second])).rows[0].approval_stage,1);
    assert.equal(attempts.length,0);
  });
  await test("Missing mapping or inactive mapped Admin fails closed with no request or Logistics email",async()=>{
    await pool.query("delete from final_approver_locations where location='Dhahran Base'");
    const missing=await actions.submitPublicRequest(input("Dhahran Base"));
    assert.equal(missing.ok,false);
    assert.equal(attempts.length,0);
    assert.equal(Number((await pool.query("select count(*) from authorizations")).rows[0].count),0);
    await reset();
    await pool.query("update profiles set is_active=false where id=$1",[ids.admin]);
    const inactive=await actions.submitPublicRequest(input("Dhahran Base"));
    assert.equal(inactive.ok,false);
    assert.equal(attempts.length,0);
    assert.equal(Number((await pool.query("select count(*) from authorizations")).rows[0].count),0);
  });
  await test("Missing stored final approver fails closed without advancing or notifying another Admin",async()=>{
    const id=await submit(); attempts.length=0;
    await pool.query("update authorizations set approver_id=null where id=$1",[id]);
    assert.equal((await approvals.approveAuthorization({id})).ok,false);
    assert.equal(attempts.length,0);
    assert.equal((await pool.query("select approval_stage from authorizations where id=$1",[id])).rows[0].approval_stage,1);
    assert.equal(await notificationCount(),2);
  });
  await test("Forgot password works for Abdullah with a null password hash",async()=>{
    const result=await auth.requestPasswordReset({email:"abdullah@example.invalid"});
    assert.equal(result.ok,true);
    assert.equal(result.data.emailed,true);
    assert(attempts[0].text.includes("https://lvas.example.invalid/reset-password/"));
  });
  await test("Missing or unsafe APP_URL never produces insecure/public fallback email",async()=>{
    delete fixtureEnv.APP_URL;
    await submit();
    assert.equal(attempts.length,0); assert.equal(await notificationCount(),2);
    await reset();
    fixtureEnv.APP_URL="https://private-user:private-password@lvas.example.invalid/track/private";
    await submit("Jafurah");
    assert.equal(attempts.length,0);
    assert(!warnings.join("").includes("private-password"));
  });
  await test("APP_URL query/hash/public path cannot leak into authenticated email URL",async()=>{
    fixtureEnv.APP_URL="https://lvas.example.invalid/track/private?token=private#private";
    await submit();
    for(const m of attempts) assert(!m.text.includes("private"));
  });
  await test("Notification-store failure after committed creation does not invite request retries",async()=>{
    notificationFailure=true;
    await submit();
    assert.equal(attempts.length,0);
    assert(warnings.some(w=>w.includes("notification_creation_failed")));
    assert(!warnings.join("").includes("PRIVATE DATABASE"));
  });
  await test("Password-reset helper preserves exact message/from/default transport and port 465 TLS",async()=>{
    await mail.sendPasswordResetEmail("admin@example.invalid","https://lvas.example.invalid/reset-password/SYNTHETIC");
    assert.equal(attempts[0].from,fixtureEnv.SMTP_FROM);
    assert.equal(attempts[0].subject,"Reset your LVAS password");
    assert.equal(attempts[0].text,[
      "A password reset was requested for your LVAS account.","",
      "Open this link to choose a new password. It expires in 30 minutes and can be used once:",
      "https://lvas.example.invalid/reset-password/SYNTHETIC","",
      "If you did not request this, you can ignore this email.",
    ].join("\n"));
    assert.equal(transports[0].port,587); assert.equal(transports[0].secure,false);
    assert.equal(transports[0].connectionTimeout,undefined);
    fixtureEnv.SMTP_PORT="465";
    await mail.sendPasswordResetEmail("admin@example.invalid","https://lvas.example.invalid/reset-password/SYNTHETIC");
    assert.equal(transports[1].secure,true);
  });
  await test("Actual forgot-password action keeps anti-enumeration response, URL and safe SMTP failure",async()=>{
    const result=await auth.requestPasswordReset({email:"admin@example.invalid"});
    assert.equal(result.ok,true); assert.equal(result.data.emailed,true);
    assert(attempts[0].text.includes("https://lvas.example.invalid/reset-password/"));
    const unknown=await auth.requestPasswordReset({email:"unknown@example.invalid"});
    assert.equal(unknown.data.emailed,true); assert.equal(attempts.length,1);
    failSmtp=true;
    assert.equal((await auth.requestPasswordReset({email:"admin@example.invalid"})).data.emailed,true);
    assert(!warnings.join("").includes("synthetic-secret"));
    delete fixtureEnv.APP_URL;
    assert.equal((await auth.requestPasswordReset({email:"admin@example.invalid"})).data.emailed,false);
  });
  console.log(`Approval-email integration: ${passed} PASS; actual PostgreSQL concurrency and SMTP mock only.`);
} finally {
  await pool.end();
}
