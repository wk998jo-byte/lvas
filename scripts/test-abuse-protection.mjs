/**
 * Real atomic PostgreSQL limiter + actual Server Actions with synthetic
 * employees/accounts/mail. Business tables are never read or changed.
 * Refuses anything except the independently confirmed Development database.
 * Usage: node scripts/test-abuse-protection.mjs
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { Pool } from "pg";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });
const ownedKeys = new Set();
const keyParams = [];
const fakeEnv = {
  SESSION_SECRET: randomUUID(), NODE_ENV: "production",
  APP_URL: "https://example.invalid", RATE_LIMIT_TRUST_PROXY_HEADERS: "true",
};
let address = "192.0.2.1";
let emailsSent = 0;
let tokensWritten = 0;
let sessionsCreated = 0;
let databaseUnavailable = false;
let forceCleanup = false;
const observedQueries = [];
function record(text, params = []) {
  observedQueries.push(text);
  if (/insert into rate_limit_buckets/.test(text)) {
    ownedKeys.add(params[0]);
    keyParams.push(params);
  }
}
const adapter = {
  connect: async () => {
    if (databaseUnavailable) throw new Error("PRIVATE DB CREDENTIAL ERROR");
    const client = await db.connect();
    return {
      query: (text, params) => { record(text, params); return client.query(text, params); },
      release: () => client.release(),
    };
  },
  query: (text, params) => { record(text, params); return db.query(text, params); },
};
const employee = {
  id: "11111111-1111-4111-8111-111111111111", badge: "555555",
  full_name: "Synthetic Employee", department: null, position: null,
  role: "other_employee", national_id: "0000009876",
};
let passwordHash;
const token = "synthetic-reset-token-" + randomUUID();
const tokenHash = createHash("sha256").update(token).digest("hex");
let tokenUsed = false;
const queryStubs = {
  getProfileByEmail: async (email) => email.trim().toLowerCase() === "known@example.invalid"
    ? { id: "synthetic-account", email, password_hash: passwordHash, is_active: true, role: "admin" } : null,
  getEmployeeForVerify: async (id) => id === employee.id ? employee : null,
  getEmployeeByBadge: async (badge) => badge === employee.badge ? employee : null,
  listAuthorizationsByEmployeeId: async () => [],
  lookupPublicEmployees: async () => [employee],
  replacePasswordResetToken: async () => { tokensWritten++; },
  resetPasswordWithTokenHash: async (input) => {
    assert.ok(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/.test(input.passwordHash));
    if (input.tokenHash !== tokenHash || tokenUsed) return false;
    tokenUsed = true;
    return true;
  },
  insertAuthorization: async () => { throw new Error("Business mutation prohibited in this test"); },
  getLastLimitRequestAt: async () => null,
};
const modules = new Map();
function load(file) {
  if (modules.has(file)) return modules.get(file);
  const cjsModule = { exports: {} };
  modules.set(file, cjsModule.exports);
  const require = (name) => {
    if (name === "node:crypto") return { ...nativeRequire(name), randomInt: () => forceCleanup ? 0 : 99 };
    if (name === "@/lib/db/pool") return { getPool: () => adapter, isOverlapViolation: () => false };
    if (name === "@/lib/db/queries") return queryStubs;
    if (name === "next/headers") return {
      headers: async () => new Headers({ "x-real-ip": address, "x-forwarded-for": address }),
      cookies: async () => ({ get: () => undefined }),
    };
    if (name === "next/cache") return { revalidatePath: () => {} };
    if (name === "@/lib/auth/session") return {
      createSession: async () => { sessionsCreated++; return "synthetic-session"; },
      setSessionCookie: async () => {},
    };
    if (name === "@/lib/auth/mail") return {
      isPasswordResetEmailConfigured: () => true,
      sendPasswordResetEmail: async () => { emailsSent++; },
    };
    if (name === "@/lib/auth/approver") return { getDefaultApproverId: async () => { throw new Error("Stop after verified identity"); } };
    if (name.startsWith("@/")) {
      const target = path.join(root, name.slice(2));
      if (target.endsWith(".json")) return JSON.parse(readFileSync(target, "utf8"));
      const candidate = [`${target}.ts`, `${target}.tsx`, `${target}/index.ts`].find(existsSync);
      assert.ok(candidate, `Missing module ${name}`);
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
    process: { env: fakeEnv }, Buffer, Headers, URL,
    console: { error: () => {} },
  }, { filename: file });
  modules.set(file, cjsModule.exports);
  return cjsModule.exports;
}
async function clear() {
  if (ownedKeys.size) await db.query("delete from rate_limit_buckets where bucket_key = any($1::text[])", [[...ownedKeys]]);
  address = "192.0.2.1";
}

try {
  const identity = await db.query("select current_database() as name, current_user as role");
  assert.equal(identity.rows[0].name, "heliumdb", "Only confirmed Development database is permitted");
  assert.equal(identity.rows[0].role, "postgres", "Unexpected database environment");
  const limiter = load("lib/security/rate-limit.ts");
  const network = load("lib/security/client-network.ts");
  const auth = load("actions/auth.ts");
  const publicActions = load("actions/public-requests.ts");
  const password = load("lib/auth/password.ts");
  passwordHash = await password.hashPassword("SyntheticCorrectPassword!");
  const attempt = (subject) => limiter.consumeRateLimit("login", subject);
  const login = (password, email = "known@example.invalid") => auth.signInWithPassword({ email, password });

  // Normal use, per-account failures across addresses, per-client many accounts.
  assert.equal((await login("SyntheticCorrectPassword!")).ok, true);
  assert.equal(sessionsCreated, 1);
  for (let i = 0; i < 8; i++) {
    address = `192.0.2.${i + 1}`;
    assert.equal((await login("wrong")).error, "Invalid email or password.");
  }
  assert.equal((await login("wrong")).error, limiter.TOO_MANY_ATTEMPTS);
  await clear();
  for (let i = 0; i < 30; i++) assert.equal((await attempt(`account-${i}`)).allowed, true);
  assert.equal((await attempt("account-31")).allowed, false);

  // Atomic admission: several instances competing for one shared account.
  await clear();
  const concurrent = await Promise.all(Array.from({ length: 40 }, () => attempt("concurrent")));
  assert.equal(concurrent.filter((permit) => permit.allowed).length, 8);

  // Windows recover; late refunds never reduce the replacement generation.
  await clear();
  const old = await attempt("generation");
  await db.query("update rate_limit_buckets set expires_at = now() - interval '1 second' where bucket_key = any($1::text[])", [[...ownedKeys]]);
  assert.equal((await attempt("generation")).allowed, true);
  await limiter.refundSuccessfulAttempt(old);
  for (let i = 0; i < 7; i++) assert.equal((await attempt("generation")).allowed, true);
  assert.equal((await attempt("generation")).allowed, false);

  // Exercise the actual bounded cleanup, not just its SQL text.
  await db.query("update rate_limit_buckets set expires_at = now() - interval '1 second' where bucket_key = any($1::text[])", [[...ownedKeys]]);
  forceCleanup = true;
  assert.equal((await attempt("cleanup-fresh")).allowed, true);
  forceCleanup = false;
  const expired = await db.query(
    "select count(*)::integer as count from rate_limit_buckets where bucket_key = any($1::text[]) and expires_at <= now()",
    [[...ownedKeys]],
  );
  assert.equal(expired.rows[0].count, 0);

  // Successful checks refund failure buckets; no full-bucket success reset.
  await clear();
  for (let i = 0; i < 10; i++) assert.equal((await login("SyntheticCorrectPassword!")).ok, true);
  for (let i = 0; i < 8; i++) assert.equal((await login("wrong")).error, "Invalid email or password.");
  assert.equal((await login("wrong")).error, limiter.TOO_MANY_ATTEMPTS);

  // Verification and status lookup share one failure budget, even across IPs.
  await clear();
  assert.equal((await publicActions.verifyEmployee({ employee_id: employee.id, id_last4: "9876" })).ok, true);
  assert.equal((await publicActions.lookupRequestsByBadge({ badge: employee.badge, id_last4: "9876" })).ok, true);
  for (let i = 0; i < 5; i++) {
    address = `198.51.100.${i + 1}`;
    const result = i % 2
      ? await publicActions.lookupRequestsByBadge({ badge: employee.badge, id_last4: "1111" })
      : await publicActions.verifyEmployee({ employee_id: employee.id, id_last4: "1111" });
    assert.equal(result.error, "Employee details and ID digits do not match.");
  }
  assert.equal((await publicActions.verifyEmployee({ employee_id: employee.id, id_last4: "1111" })).error, limiter.TOO_MANY_ATTEMPTS);
  assert.equal((await publicActions.lookupRequestsByBadge({ badge: employee.badge, id_last4: "1111" })).error, limiter.TOO_MANY_ATTEMPTS);
  const submission = {
    employee_id: employee.id, id_last4: "1111",
    vehicle_id: "22222222-2222-4222-8222-222222222222",
    start_date: "2099-01-01", end_date: "2099-01-01", duration_label: "1 day",
    purpose: "Synthetic test",
    contact_mobile: "555555555", location: "Jafurah", justification: "Synthetic test",
  };
  assert.equal((await publicActions.submitPublicRequest(submission)).error, limiter.TOO_MANY_ATTEMPTS);

  // Unknown identity yields the same generic wrong-details result.
  await clear();
  const missing = await publicActions.lookupRequestsByBadge({ badge: "999999", id_last4: "1111" });
  const wrong = await publicActions.lookupRequestsByBadge({ badge: employee.badge, id_last4: "1111" });
  assert.equal(missing.error, wrong.error);

  // Forgot password: existing, missing, throttled and unavailable are identical.
  await clear();
  const baseline = await auth.requestPasswordReset({ email: "known@example.invalid" });
  for (let i = 0; i < 4; i++) assert.equal(JSON.stringify(await auth.requestPasswordReset({ email: " KNOWN@example.invalid ".trim() })), JSON.stringify(baseline));
  const beforeEmail = emailsSent;
  assert.equal(beforeEmail, 5, "five legitimate reset requests send five emails");
  const beforeToken = tokensWritten;
  assert.equal(JSON.stringify(await auth.requestPasswordReset({ email: "known@example.invalid" })), JSON.stringify(baseline));
  assert.equal(emailsSent, beforeEmail);
  assert.equal(tokensWritten, beforeToken);
  assert.equal(JSON.stringify(await auth.requestPasswordReset({ email: "missing@example.invalid" })), JSON.stringify(baseline));

  // Reset token semantics remain intact; throttling precedes expensive hashing.
  await clear();
  const resetInput = { token, new_password: "SyntheticNewPassword!", confirm_password: "SyntheticNewPassword!" };
  assert.equal((await auth.resetPasswordWithToken(resetInput)).ok, true);
  assert.equal((await auth.resetPasswordWithToken(resetInput)).error, "This reset link is invalid or has expired.");
  for (let i = 0; i < 28; i++) await auth.resetPasswordWithToken(resetInput);
  assert.equal((await auth.resetPasswordWithToken(resetInput)).error, limiter.TOO_MANY_ATTEMPTS);

  // Untrusted/missing headers cannot manufacture new network buckets.
  fakeEnv.RATE_LIMIT_TRUST_PROXY_HEADERS = "false";
  assert.equal(network.clientNetwork(new Headers()).trusted, false);
  assert.equal(network.clientNetwork(new Headers({ "x-real-ip": "203.0.113.8" })).identifier, "unverified-network");
  await clear();
  for (let i = 0; i < 8; i++) {
    address = `203.0.113.${i + 1}`;
    assert.equal((await attempt("untrusted-account")).allowed, true);
  }
  assert.equal((await attempt("untrusted-account")).allowed, false);

  // Database/configuration failures cannot disable protection or leak details.
  databaseUnavailable = true;
  assert.equal((await login("wrong")).error, limiter.TOO_MANY_ATTEMPTS);
  assert.equal(JSON.stringify(await auth.requestPasswordReset({ email: "known@example.invalid" })), JSON.stringify(baseline));
  databaseUnavailable = false;
  await clear();
  // An SMTP/database error after account lookup still has a generic response.
  const originalReplaceToken = queryStubs.replacePasswordResetToken;
  queryStubs.replacePasswordResetToken = async () => { throw new Error("PRIVATE RESET DB DETAIL"); };
  assert.equal(JSON.stringify(await auth.requestPasswordReset({ email: "known@example.invalid" })), JSON.stringify(baseline));
  queryStubs.replacePasswordResetToken = originalReplaceToken;
  fakeEnv.SESSION_SECRET = "";
  assert.equal((await attempt("missing-secret")).allowed, false);
  assert.ok(keyParams.every(([key, limit, window]) =>
    /^[0-9a-f]{64}$/.test(key) && Number.isInteger(limit) && Number.isInteger(window)));
  assert.ok(!observedQueries.some((sql) => /insert into (employees|profiles|authorizations|vehicles)/i.test(sql)));
  const schema = await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='rate_limit_buckets' order by ordinal_position",
  );
  assert.deepEqual(schema.rows.map((row) => row.column_name), ["bucket_key", "attempts", "expires_at"]);
  assert.ok(observedQueries.some((sql) => /on conflict \(bucket_key\) do update/.test(sql)));
  assert.ok(readFileSync(path.join(root, "lib/security/rate-limit.ts"), "utf8").includes("limit 500 for update skip locked"));
  console.log("abuse-protection: PASS (real Development PostgreSQL atomicity, concurrency, Server Actions, shared identity limits, privacy, expiry, generic responses)");
} finally {
  await clear();
  await db.end();
}
