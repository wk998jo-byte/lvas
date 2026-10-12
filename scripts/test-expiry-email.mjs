// Actual expiry job, cron handler, queries and mailer. Disposable PG + mocked SMTP only.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { Pool } from "pg";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
const pool = new Pool({
  host: "127.0.0.1", port: 15439, database: "heliumdb",
  user: "postgres", password: "disposable-fixture-unused", ssl: false, max: 14,
});
assert.equal((await pool.query("select current_setting('data_directory') as dir")).rows[0].dir,
  "/tmp/lvas-approval-email-pg", "Only the dedicated disposable cluster is permitted");
const schema = readFileSync(path.join(root, "db/schema.sql"), "utf8");
const ids = Object.fromEntries(["ejaz","waqar","noorah","jafurah","unassigned","inactive","empty","invalid",
  "admin","otherAdmin"].map(name => [name, randomUUID()]));
const env = {
  NODE_ENV: "production", APP_URL: "https://lvas.example.invalid",
  SMTP_HOST: "smtp.example.invalid", SMTP_FROM: "sender@example.invalid",
  SMTP_USER: "synthetic-user", SMTP_PASSWORD: "synthetic-secret", CRON_SECRET: "synthetic-cron",
  EXPIRY_EMAIL_START_AT: "2030-01-08T09:00:00+03:00",
};
let clock = "2030-01-11T09:00:00+03:00", failSmtp = false, failNotification = false;
const attempts = [], transports = [], warnings = [], cache = new Map();
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return Date.parse(clock); }
}
const query = async (text, params = []) => {
  if (failNotification && /insert into notifications/i.test(text)) throw new Error("PRIVATE DATABASE DETAILS");
  return (await pool.query(text,params)).rows;
};
const adapter = {
  query, queryOne: async (...args) => (await query(...args))[0] ?? null,
  execute: async (text,params) => (await pool.query(text,params)).rowCount,
  getPool: () => pool,
};
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const cjs = { exports: {} };
  const require = name => {
    if (name === "nodemailer") return {
      createTransport: options => {
        transports.push(options);
        return { sendMail: async message => {
          attempts.push(message);
          if (failSmtp) throw new Error("PRIVATE SMTP AUTH synthetic-secret PRIVATE-TOKEN");
        } };
      },
    };
    if (name === "@/lib/db/pool") return adapter;
    if (name === "next/server") return {
      NextResponse: { json: (data,options={}) => ({ data,status:options.status??200 }) },
    };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      if (stem.endsWith(".json")) return JSON.parse(readFileSync(path.join(root,stem),"utf8"));
      const target = [stem+".ts",stem+".tsx",stem+"/index.ts"].find(p=>existsSync(path.join(root,p)));
      assert(target,"Missing import "+name);
      return load(target);
    }
    return nativeRequire(name);
  };
  vm.runInNewContext(ts.transpileModule(readFileSync(path.join(root,file),"utf8"),{
    fileName:file,compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
    },
  }).outputText,{
    module:cjs,exports:cjs.exports,require,Date:TestDate,URL,Buffer,
    process:{env},console:{
      warn:(...args)=>warnings.push(JSON.stringify(args)),
      error:(...args)=>warnings.push(JSON.stringify(args)),
    },
  },{filename:file});
  cache.set(file,cjs.exports);
  return cjs.exports;
}
const job = load("lib/expiry-alarms.ts");
const events = load("lib/notifications/expiry-email.ts");
const queries = load("lib/db/queries.ts");
const cron = load("app/api/cron/expiry-alarms/route.ts");
const locations = load("lib/approvals/logistics-team.ts").PROJECT_LOCATIONS;
const now = () => new Date(clock);
const run = () => job.runExpiryAlarms(now());
async function reset() {
  await pool.query("drop schema public cascade; create schema public");
  await pool.query(schema);
  for (const [name,id] of Object.entries(ids)) {
    await pool.query(`insert into profiles(id,full_name,email,role,is_active) values($1,$2,$3,$4,$5)`,
      [id,"Synthetic "+name,name==="empty"?"":name==="invalid"?"invalid-email":name+"@example.invalid",
        ["admin","otherAdmin"].includes(name)?"admin":"logistics_approver",name!=="inactive"]);
  }
  for (const [name,scope] of Object.entries({
    ejaz:["Dhahran Base"],waqar:["Dhahran Base"],noorah:locations,jafurah:["Jafurah"],
    inactive:["Dhahran Base"],empty:["Facility"],invalid:["Facility"],
  })) {
    for (const location of scope) await pool.query(
      "insert into logistics_approver_locations(profile_id,location) values($1,$2)",[ids[name],location]);
  }
  attempts.length=transports.length=warnings.length=0;
  failSmtp=failNotification=false;
  clock="2030-01-11T09:00:00+03:00";
  env.EXPIRY_EMAIL_START_AT="2030-01-08T09:00:00+03:00";
  env.APP_URL="https://lvas.example.invalid";
}
async function authorization({
  days=3,location="Dhahran Base",status="approved",requester=null,createdAt="2020-01-01T00:00:00Z",
}={}) {
  const id=randomUUID(), employee=randomUUID(), vehicle=randomUUID();
  const endDate=load("lib/business-date.ts").addCalendarDays("2030-01-11",days);
  await pool.query(`insert into employees(id,badge,full_name,national_id,role)
    values($1,$2,'Synthetic Employee','1234567890','other_employee')`,[employee,"TEST-"+employee.slice(0,8)]);
  await pool.query(`insert into vehicles(id,door_number,make,model)
    values($1,$2,'Toyota','Synthetic Model')`,[vehicle,"006-01-TEST-"+vehicle.slice(0,8)]);
  await pool.query(`insert into authorizations(id,vehicle_id,employee_id,requester_id,approver_id,
    status,approval_stage,start_date,end_date,duration_label,location,purpose,justification,
    rejection_reason,created_at,approved_at)
    values($1,$2,$3,$4,$5,$6,2,$7::date-interval '7 days',$7,'7 days',$8,
      'Synthetic business purpose','Synthetic business purpose',$9,$10,$10)`,
    [id,vehicle,requester?null:employee,requester,ids.admin,status,endDate,location,
      status==="rejected"?"Synthetic rejection":null,createdAt]);
  return {id,employee,vehicle,endDate};
}
const notifications = async id => (await pool.query(
  "select user_id,dedupe_key,type from notifications where authorization_id=$1 order by user_id",[id])).rows;
const emailRecipients = () => attempts.map(m=>m.to).sort();
const expectedDhahran = ["ejaz@example.invalid","noorah@example.invalid","waqar@example.invalid"];
let passed=0;
async function test(name,fn) { await reset(); await fn(); passed++; console.log("PASS: "+name); }
try {
  await test("Exactly 3 Saudi days: dynamic assigned Logistics, business content and protected URL",async()=>{
    const a=await authorization(); const result=await run();
    assert.equal(result.emailsAttempted,3); assert.equal(result.created,4); assert.equal(result.expiredMarked,0);
    assert.deepEqual(emailRecipients(),expectedDhahran);
    assert.equal((await notifications(a.id)).filter(n=>n.user_id===ids.admin).length,1,"Original Admin in-app fallback retained");
    for (const m of attempts) {
      assert.equal(m.subject,"LVAS – Vehicle Authorization Expiring Soon");
      for(const value of ["Synthetic Employee","TEST-","006-01-TEST-","Toyota Synthetic Model",
        "Dhahran Base",a.endDate,"Synthetic business purpose","Current authorization status: approved",
        `https://lvas.example.invalid/history/${a.id}`]) assert(m.text.includes(value),value);
      assert(!m.text.includes("/track/")&&!m.text.includes("/verify/")&&!m.text.includes("/reset-password/"));
      const token=(await pool.query("select public_token from authorizations where id=$1",[a.id])).rows[0].public_token;
      assert(!m.text.includes(token)); assert(!m.text.includes("1234567890"));
    }
    assert.equal(transports[0].socketTimeout,10000);
  });
  await test("Expiry day remains canonically approved and sends distinct today subject",async()=>{
    const a=await authorization({days:0}); await run();
    assert.deepEqual(emailRecipients(),expectedDhahran);
    assert(attempts.every(m=>m.subject==="LVAS – Vehicle Authorization Expires Today"));
    assert.equal((await pool.query("select status from authorizations where id=$1",[a.id])).rows[0].status,"approved");
    assert((await notifications(a.id)).some(n=>n.dedupe_key===`authorization-expiry-day:${a.id}:${ids.ejaz}`));
  });
  await test("4+ days and the old 7-day/1-day thresholds generate no alerts",async()=>{
    for(const days of [4,7,12,1]) await authorization({days});
    const result=await run(); assert.equal(result.created,0); assert.equal(attempts.length,0);
  });
  await test("Jafurah cannot email Dhahran-only, unassigned, inactive or Admin profiles",async()=>{
    await authorization({location:"Jafurah"}); await run();
    assert.deepEqual(emailRecipients(),["jafurah@example.invalid","noorah@example.invalid"]);
  });
  await test("Noorah's all-site assignment works dynamically at all nine current locations",async()=>{
    for(const location of locations) await authorization({location});
    await run();
    assert.equal(attempts.filter(m=>m.to==="noorah@example.invalid").length,9);
  });
  await test("New profile/location assignment is discovered without hardcoding or roster changes",async()=>{
    await pool.query("insert into logistics_approver_locations(profile_id,location) values($1,'Dhahran Base')",[ids.unassigned]);
    await authorization(); await run();
    assert.deepEqual(emailRecipients(),[...expectedDhahran,"unassigned@example.invalid"].sort());
  });
  await test("Repeated checks produce no duplicate notifications or SMTP attempts",async()=>{
    const a=await authorization(); await run(); await run(); await run();
    assert.equal(attempts.length,3); assert.equal((await notifications(a.id)).length,4);
  });
  await test("Twenty concurrent real PG executions claim each stage/recipient exactly once",async()=>{
    const a=await authorization(); await Promise.all(Array.from({length:20},run));
    assert.equal(attempts.length,3); assert.equal((await notifications(a.id)).length,4);
  });
  await test("SMTP failure leaves all business data unchanged and cannot be retried",async()=>{
    const a=await authorization();
    const before=(await pool.query("select row_to_json(a) as value from authorizations a where id=$1",[a.id])).rows[0].value;
    failSmtp=true; const result=await run(); await run();
    assert.equal(result.deliveryFailures,3); assert.equal(attempts.length,3);
    assert.deepEqual((await pool.query("select row_to_json(a) as value from authorizations a where id=$1",[a.id])).rows[0].value,before);
    assert.equal((await notifications(a.id)).length,4);
    assert(!warnings.join("").includes("synthetic-secret")&&!warnings.join("").includes("PRIVATE SMTP"));
    assert(!result.errors.join("").includes("PRIVATE"));
  });
  await test("Rejected, pending, cancelled and stored-expired records never produce alerts",async()=>{
    for(const status of ["rejected","pending","cancelled","expired"]) await authorization({status,days:0});
    const result=await run(); assert.equal(result.created,0); assert.equal(attempts.length,0);
  });
  await test("Historical expired rows never email; existing status maintenance is retained",async()=>{
    const a=await authorization({days:-1}); await authorization({days:-100,status:"expired"});
    const result=await run(); assert.equal(result.expiredMarked,1); assert.equal(result.created,0);
    assert.equal(attempts.length,0);
    assert.equal((await pool.query("select status from authorizations where id=$1",[a.id])).rows[0].status,"expired");
  });
  await test("Missing, malformed, future and activation-day cutoff fail closed without disabling in-app alerts",async()=>{
    const a=await authorization();
    for(const activation of [undefined,"invalid-private-value","2030-02-01T00:00:00Z","2030-01-11T00:00:00+03:00"]) {
      if(activation===undefined) delete env.EXPIRY_EMAIL_START_AT; else env.EXPIRY_EMAIL_START_AT=activation;
      await run(); assert.equal(attempts.length,0);
    }
    assert.equal((await notifications(a.id)).length,4);
    assert(!warnings.join("").includes("invalid-private-value"));
  });
  await test("Existing approvals get future stages only; activation never replays an old 3-day stage",async()=>{
    const a=await authorization(); env.EXPIRY_EMAIL_START_AT=clock;
    await run(); assert.equal(attempts.length,0);
    clock="2030-01-12T09:00:00+03:00"; await run(); assert.equal(attempts.length,0);
    clock="2030-01-14T09:00:00+03:00"; await run();
    assert.equal(attempts.length,3); assert(attempts.every(m=>m.subject.includes("Expires Today")));
    assert.equal((await notifications(a.id)).length,8);
  });
  await test("Asia/Riyadh UTC boundary, not UTC date, determines the exact alert stage",async()=>{
    await authorization();
    clock="2030-01-10T20:59:59Z"; await run(); assert.equal(attempts.length,0);
    clock="2030-01-10T21:00:00Z"; await run(); assert.equal(attempts.length,3);
  });
  await test("Legacy requester who is assigned Logistics gets one notification and one email, not two",async()=>{
    const a=await authorization({requester:ids.ejaz}); await run(); await run();
    assert.equal((await notifications(a.id)).length,3); assert.equal(attempts.length,3);
    assert((await notifications(a.id)).some(n=>n.dedupe_key===`${a.id}:expiry:3`));
  });
  await test("Existing legacy 3-day claim remains honored, without creating a duplicate in-app alert",async()=>{
    const a=await authorization({requester:ids.ejaz});
    await queries.insertNotification({
      user_id:ids.ejaz,authorization_id:a.id,type:"expiry_warning",
      title:"Existing 3-day alert",body:"Existing in-app expiry warning",dedupe_key:`${a.id}:expiry:3`,
    });
    await run(); assert.equal(attempts.length,2); assert.equal((await notifications(a.id)).length,3);
    assert(!attempts.some(m=>m.to==="ejaz@example.invalid"));
  });
  await test("Missing/legacy/unassigned locations have no global Logistics fallback",async()=>{
    for(const location of [null,"Unknown Legacy Location"," Dhahran Base "]) await authorization({location});
    await run(); assert.equal(attempts.length,0);
  });
  await test("Missing or invalid emails retain in-app alerts but skip SMTP",async()=>{
    const a=await authorization({location:"Facility"}); await run();
    assert.deepEqual(emailRecipients(),["noorah@example.invalid"]);
    assert.equal((await notifications(a.id)).length,4);
  });
  await test("Cancellation or location revocation between scan and claim is rejected atomically",async()=>{
    const a=await authorization();
    const input={authorizationId:a.id,recipientId:ids.ejaz,endDate:a.endDate,daysLeft:3,today:"2030-01-11",
      sentAt:now().toISOString(),title:"Test",body:"Test",dedupeKey:"race-test",requiresLogistics:true,allowEmail:true};
    await pool.query("update authorizations set status='cancelled' where id=$1",[a.id]);
    assert.equal((await events.notifyExpiryEvent(input)).created,false);
    await pool.query("update authorizations set status='approved' where id=$1",[a.id]);
    await pool.query("delete from logistics_approver_locations where profile_id=$1",[ids.ejaz]);
    assert.equal((await events.notifyExpiryEvent(input)).created,false); assert.equal(attempts.length,0);
  });
  await test("Notification failure and unsafe APP_URL are isolated and never leak private details",async()=>{
    await authorization(); failNotification=true;
    const result=await run(); assert.equal(result.created,0); assert.equal(attempts.length,0);
    assert(!warnings.join("").includes("PRIVATE DATABASE")); failNotification=false;
    env.APP_URL="https://private-user:private-password@lvas.example.invalid/track/private";
    await run(); assert.equal(attempts.length,0);
    assert(!warnings.join("").includes("private-password"));
  });
  await test("Authenticated cron GET/POST share the same path and dedupe; unauthorized calls do nothing",async()=>{
    const a=await authorization();
    assert.equal((await cron.GET(new Request("https://lvas.example.invalid/api/cron/expiry-alarms"))).status,401);
    assert.equal((await notifications(a.id)).length,0);
    const request=()=>new Request("https://lvas.example.invalid/api/cron/expiry-alarms",
      {headers:{authorization:"Bearer synthetic-cron"}});
    assert.equal((await cron.GET(request())).data.ok,true);
    assert.equal((await cron.POST(request())).data.ok,true);
    assert.equal(attempts.length,3); assert.equal((await notifications(a.id)).length,4);
  });
  console.log(`Expiry-email integration: ${passed} PASS; actual PostgreSQL concurrency + mocked SMTP only.`);
} finally { await pool.end(); }
