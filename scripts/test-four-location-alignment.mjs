/**
 * Synthetic fixtures only; refuses all but the owned disposable cluster.
 * Optional args: manual.sql production-baseline.json targets.json.
 * With these args, execute the exact Production file to prove it refuses synthetic
 * data, then substitute ONLY its pinned fingerprint literals for the fixtures.
 * Statement sequence, identities, counts, conditions and writes remain identical.
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { Client } from "pg";
import ts from "typescript";
import { buildAlignmentSql, fingerprintQuery, originalLocations, newLocations, protectedTables } from "./logistics-location-alignment.mjs";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.equal(process.env.LVAS_DISPOSABLE_TEST_DB, "1");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.port, "15439");
assert.equal(url.pathname, "/heliumdb");
const db = new Client({ connectionString: url.href });
await db.connect();
assert.equal((await db.query("select current_setting('data_directory') as dir")).rows[0].dir, "/tmp/lvas-approval-email-pg");
await db.query("set time zone 'GMT'");
const root = path.resolve(import.meta.dirname, "..");
const read = file => readFileSync(path.join(root, file), "utf8");
const roster = JSON.parse(read("lib/approvals/logistics-roster.json"));
const productionSql = process.argv[2] ? readFileSync(process.argv[2], "utf8") : null;
const productionBaseline = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : null;
const targets = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], "utf8")) : newLocations.map(location => {
  const person = roster.find(p => p.locations.includes(location));
  return { location, profile_id: randomUUID(), employee_id: randomUUID(),
    full_name: person.fullName, email: person.email, badge: person.badge,
    position: person.position, department: "Logistics Department" };
});
const fixtureCounts = productionBaseline ?? {
  vehicles: { row_count: 758 }, sessions: { row_count: 8 },
  password_reset_tokens: { row_count: 1 }, rate_limit_buckets: { row_count: 12 },
};
const oldIds = new Map();
const vehicle = randomUUID(), oldRequests = [randomUUID(), randomUUID()];
let admin, noorah;
const digest = value => createHash("sha256").update(value).digest("hex");
async function reset() {
  await db.query("rollback");
  await db.query("drop schema public cascade; create schema public");
  await db.query(read("db/schema.sql"));
  await db.query(read("db/migrations/20261006_abuse_rate_limits.sql"));
  oldIds.clear();
  for (const person of roster.filter(p => !p.locations.some(l => newLocations.includes(l)))) {
    const id = randomUUID(); oldIds.set(person.email, id);
    await db.query("insert into profiles(id,full_name,email,role,password_hash) values($1,$2,$3,'logistics_approver',$4)",
      [id, person.fullName, person.email, "synthetic-existing-hash"]);
    for (const location of person.locations) await db.query(
      "insert into logistics_approver_locations values($1,$2)", [id, location]);
    if (person.fullName === "Noorah") noorah = id;
  }
  for (let i=0;i<3;i++) {
    admin=randomUUID();
    await db.query("insert into profiles(id,full_name,email,role) values($1,$2,$3,'admin')",
      [admin,"Synthetic Admin "+i,`admin${i}@example.invalid`]);
  }
  for (const t of targets) {
    const person=roster.find(p=>p.locations.includes(t.location));
    assert.equal(t.full_name,person.fullName); assert.equal(t.email,person.email);
    assert.equal(t.badge,person.badge); assert.equal(t.position,person.position);
    await db.query("insert into employees(id,full_name,badge,department,position,role) values($1,$2,$3,$4,$5,'manager_requester')",
      [t.employee_id,t.full_name,t.badge,t.department,t.position]);
  }
  await db.query(`insert into employees(badge,full_name,role)
    select 'SYN-'||n,'Synthetic Employee '||n,'other_employee' from generate_series(1,6307) n`);
  await db.query("insert into vehicles(id,door_number,make,model) values($1,'SYN-PRIMARY','Synthetic','Fixture')",[vehicle]);
  if (fixtureCounts.vehicles.row_count>1) await db.query(`insert into vehicles(door_number,make,model)
    select 'SYN-'||n,'Synthetic','Fixture' from generate_series(1,$1::int) n`,
    [fixtureCounts.vehicles.row_count-1]);
  const recipients=[
    oldIds.get("waqar.ahmad@binquraya.com"), noorah,
    oldIds.get("muhammad.ejaz@binquraya.com"),
  ];
  for (let i=0;i<2;i++) {
    const employee=(await db.query("select id from employees where badge=$1",["SYN-"+(i+1)])).rows[0].id;
    await db.query(`insert into authorizations(id,vehicle_id,employee_id,approver_id,status,approval_stage,location,start_date,end_date,duration_label)
      values($1,$2,$3,$4,'pending',$5,'Dhahran Base',$6,$6,'1 day')`,
      [oldRequests[i],vehicle,employee,admin,i===0?2:1,`2030-01-${String(i+1).padStart(2,"0")}`]);
    for (const user of i===0?[...recipients,admin]:recipients) await db.query(
      "insert into notifications(user_id,authorization_id,type,title,body) values($1,$2,'request_submitted','Synthetic fixture','Synthetic fixture')",
      [user,oldRequests[i]]);
  }
  for (let i=0;i<fixtureCounts.sessions.row_count;i++) await db.query(
    "insert into sessions(profile_id,token_hash,expires_at) values($1,$2,'2099-01-01')",[admin,digest("fixture-session-"+i)]);
  for (let i=0;i<fixtureCounts.password_reset_tokens.row_count;i++) await db.query(
    "insert into password_reset_tokens(profile_id,token_hash,expires_at) values($1,$2,'2099-01-01')",[admin,digest("fixture-reset-"+i)]);
  for (let i=0;i<fixtureCounts.rate_limit_buckets.row_count;i++) await db.query(
    "insert into rate_limit_buckets values($1,1,'2099-01-01')",[digest("fixture-bucket-"+i)]);
}
async function baseline() {
  const result={};
  for(const table of protectedTables) result[table]=(await db.query(fingerprintQuery(table))).rows[0];
  return result;
}
function script(b) {
  const generated=buildAlignmentSql({baseline:b,targets});
  if (!productionSql) return generated;
  assert.equal(productionSql,buildAlignmentSql({baseline:productionBaseline,targets}));
  let translated=productionSql;
  for(const table of protectedTables) {
    assert.equal(b[table].row_count,productionBaseline[table].row_count);
    translated=translated.replaceAll(productionBaseline[table].fingerprint,b[table].fingerprint);
  }
  assert.equal(translated,generated,"ONLY fingerprint literals may differ from the exact manual SQL");
  return translated;
}
async function refuse(sql) {
  const before=await baseline();
  await assert.rejects(db.query(sql));
  await db.query("rollback");
  assert.deepEqual(await baseline(),before,"Refusal must roll back every business row");
}
let passed=0;
const pass=name=>{passed++;console.log("PASS: "+name);};
try {
  await reset();
  const before=await baseline(), sql=script(before);
  assert.equal((sql.match(/INSERT INTO public\./g)??[]).length,2);
  assert(!/\b(?:UPDATE|DELETE|ALTER|DROP|TRUNCATE)\s+(?:TABLE\s+)?public\./i.test(sql));
  assert(!/\bON CONFLICT\b/i.test(sql));
  await db.query(sql);
  const counts=(await db.query(`select
    (select count(*)::int from profiles) profiles,
    (select count(*)::int from profiles where role='logistics_approver' and is_active) active,
    (select count(*)::int from logistics_approver_locations) assignments,
    (select count(*)::int from employees) employees,
    (select count(*)::int from authorizations) authorizations,
    (select count(*)::int from notifications) notifications`)).rows[0];
  assert.deepEqual(counts,{profiles:19,active:16,assignments:24,employees:6311,authorizations:2,notifications:7});
  for(const t of targets) {
    const p=(await db.query("select * from profiles where id=$1",[t.profile_id])).rows[0];
    assert.equal(p.password_hash,null); assert.equal(p.role,"logistics_approver");
    assert.equal(p.is_active,true); assert.equal(p.full_name,t.full_name); assert.equal(p.email,t.email);
    assert.equal((await db.query("select role from employees where id=$1",[t.employee_id])).rows[0].role,"manager_requester");
    assert.deepEqual((await db.query("select location from logistics_approver_locations where profile_id=$1",[t.profile_id])).rows.map(r=>r.location),[t.location]);
    assert.equal((await db.query("select count(*)::int n from logistics_approver_locations where location=$1",[t.location])).rows[0].n,1);
  }
  assert.deepEqual((await db.query("select location from logistics_approver_locations where profile_id=$1 order by location",[noorah])).rows.map(r=>r.location),[...originalLocations].sort());
  for(const table of protectedTables) {
    const key=table==="profiles"?"id":table==="logistics_approver_locations"?"profile_id":null;
    const predicate=key?`where t.${key} not in (${targets.map(t=>"'"+t.profile_id+"'").join(",")})`:"";
    assert.deepEqual((await db.query(fingerprintQuery(table,predicate))).rows[0],before[table]);
  }
  pass("Exact +4 profiles / +4 single-site assignments; 19/16/24/6311/2/7; NULL passwords; unchanged employees/Noorah/all protected rows");
  await refuse(sql); pass("Second execution safely refuses without changing any rows");

  // Actual Forgot Password/reset/login actions for every newly provisioned account;
  // SMTP is mocked and no real session cookie or password is created outside fixtures.
  const native=createRequire(import.meta.url), cache=new Map(); let delivered;
  const adapter={
    query:async(s,p)=>(await db.query(s,p)).rows,
    queryOne:async(s,p)=>(await db.query(s,p)).rows[0]??null,
    getPool:()=>({connect:async()=>({query:(...args)=>db.query(...args),release:()=>{}})}),
  };
  function load(file) {
    if(cache.has(file))return cache.get(file);
    const cjs={exports:{}};
    const require=name=>{
      if(name==="@/lib/db/pool")return adapter;
      if(name==="@/lib/auth/mail")return {isPasswordResetEmailConfigured:()=>true,sendPasswordResetEmail:async(email,resetUrl)=>{delivered={email,resetUrl};}};
      if(name==="@/lib/auth/session")return {createSession:async()=>"synthetic-cookie",setSessionCookie:async()=>{}};
      if(name==="@/lib/security/rate-limit")return {consumeRateLimit:async()=>({allowed:true}),refundSuccessfulAttempt:async()=>{}};
      if(name==="next/headers")return {headers:async()=>new Map()};
      if(name==="next/cache")return {revalidatePath:()=>{}};
      if(name.startsWith("@/")) {
        const stem=name.slice(2);
        if(stem.endsWith(".json"))return JSON.parse(read(stem));
        const resolved=[stem+".ts",stem+".tsx",stem+"/index.ts"].find(p=>existsSync(path.join(root,p)));
        assert(resolved,name);return load(resolved);
      }
      return native(name);
    };
    vm.runInNewContext(ts.transpileModule(read(file),{fileName:file,compilerOptions:{
      module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
    }}).outputText,{module:cjs,exports:cjs.exports,require,console,Buffer,URL,
      process:{env:{NODE_ENV:"production",APP_URL:"https://fixture.example.invalid"}}},{filename:file});
    cache.set(file,cjs.exports);return cjs.exports;
  }
  const auth=load("actions/auth.ts");
  for(const t of targets) {
    assert.equal((await auth.signInWithPassword({email:t.email,password:"Synthetic-new-password"})).ok,false);
    assert.equal((await auth.requestPasswordReset({email:t.email})).ok,true);
    assert.equal(delivered.email,t.email);
    const token=new URL(delivered.resetUrl).pathname.split("/").at(-1);
    const resetInput={token,new_password:"Synthetic-new-password",confirm_password:"Synthetic-new-password"};
    assert.equal((await auth.resetPasswordWithToken(resetInput)).ok,true);
    assert.equal((await auth.resetPasswordWithToken(resetInput)).ok,false);
    assert.equal((await auth.signInWithPassword({email:t.email,password:resetInput.new_password})).ok,true);
  }
  pass("All four NULL-password accounts support actual Forgot Password/redemption/login; reset-token replay rejected");

  const cases=[
    ["case-insensitive email collision",async()=>db.query("update profiles set email=$1 where id=$2",[targets[0].email.toUpperCase(),admin])],
    ["employee mismatch",async()=>db.query("update employees set full_name='Synthetic mismatch' where id=$1",[targets[0].employee_id])],
    ["assignment collision",async()=>db.query("update logistics_approver_locations set location=$1 where profile_id=$2 and location='Dhahran Base'",[newLocations[0],noorah])],
    ["authorization drift",async()=>db.query("update authorizations set status='cancelled' where id=$1",[oldRequests[0]])],
    ["notification drift",async()=>db.query("update notifications set is_read=true where user_id=$1",[admin])],
  ];
  for(const[name,mutate]of cases) {
    await reset();const clean=await baseline();const guarded=script(clean);
    await mutate();await refuse(guarded);pass(name+" refuses and rolls back");
  }
  // Reach semantic guards too, rather than relying solely on fingerprint mismatch.
  for(const[name,mutate]of cases.slice(0,3)) {
    await reset();await mutate();await refuse(script(await baseline()));
    pass(name+" rejected independently by identity/location guards");
  }
  await reset();const cleanSql=script(await baseline());
  for(const statement of cleanSql.split(";").map(s=>s.trim()).filter(Boolean)) {
    if(/^BEGIN$|^COMMIT$/i.test(statement))continue;
    // Remove the first introductory comments to simulate a statement-splitting console.
    const s=statement.replace(/^--[^\n]*\n/gm,"").trim();
    if(!s||/^BEGIN$|^COMMIT$/i.test(s))continue;
    try {await db.query(s);} catch { /* Refusal expected; keep testing later INSERTs. */ }
  }
  assert.equal((await db.query("select count(*)::int n from profiles")).rows[0].n,15);
  assert.equal((await db.query("select count(*)::int n from logistics_approver_locations")).rows[0].n,20);
  pass("Unsafe per-statement autocommit performs zero business writes");
  if(productionSql) {
    await reset();await refuse(productionSql);
    pass("Unmodified Production SQL refuses nonmatching synthetic data; simulation changes only fingerprint literals");
  }
  console.log(`Four-location alignment: ${passed} PASS (disposable PostgreSQL only)`);
} finally {await db.query("rollback");await db.end();}
