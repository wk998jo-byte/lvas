/**
 * Javed-only provisioning. Default: read-only dry-run.
 * Never executed automatically by startup, build, or publishing.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { requireDatabaseUrl } from "./env.mjs";

const roster = JSON.parse(readFileSync(
  fileURLToPath(new URL("../lib/approvals/logistics-roster.json", import.meta.url)), "utf8",
));
export const JAVED = roster.find(person => person.email === "javed.khan@binquraya.com");
assert.ok(JAVED, "Javed configuration missing");
assert.equal(roster.filter(person => person.email === JAVED.email).length, 1);
assert.equal(JAVED.fullName, "Muhammad Javed Iqbal Khan");
assert.equal(JAVED.badge, "1444");
assert.deepEqual(JAVED.locations, ["Asset Department"]);
export const CONFIRMATION = "CREATE_JAVED_ASSET_DEPARTMENT_PROFILE";

// Return fingerprints only; never return or print existing credential values.
async function protectedState(client) {
  const result = await client.query(`
    select
      (select md5(coalesce(string_agg(row_to_json(p)::text, '' order by id), ''))
       from profiles p where lower(email) <> lower($1)) as other_profiles,
      (select md5(coalesce(string_agg(row_to_json(e)::text, '' order by id), ''))
       from employees e) as employees,
      (select md5(coalesce(string_agg(row_to_json(s)::text, '' order by id), ''))
       from sessions s) as sessions,
      (select md5(coalesce(string_agg(row_to_json(l)::text, '' order by profile_id, location), ''))
       from logistics_approver_locations l
       where profile_id not in (select id from profiles where lower(email) = lower($1))) as other_assignments,
      (select md5(coalesce(string_agg(row_to_json(a)::text, '' order by id), ''))
       from authorizations a) as authorizations,
      (select md5(coalesce(string_agg(row_to_json(n)::text, '' order by id), ''))
       from notifications n) as notifications
  `, [JAVED.email]);
  return result.rows[0];
}

async function profileState(client) {
  const result = await client.query(`
    select id, full_name, email, role, is_active, password_hash is null as password_unset
    from profiles where lower(email) = lower($1)
  `, [JAVED.email]);
  return result.rows;
}

async function assertAligned(client, profiles, { newlyCreated = false } = {}) {
  assert.equal(profiles.length, 1, "Duplicate email refused");
  const profile = profiles[0];
  assert.equal(profile.full_name, JAVED.fullName, "Existing email belongs to a different profile");
  assert.equal(profile.email, JAVED.email, "Existing email is not the exact configured email");
  assert.equal(profile.role, "logistics_approver", "Existing role must not be changed");
  assert.equal(profile.is_active, true, "Existing inactive profile must not be changed");
  if (newlyCreated) assert.equal(profile.password_unset, true, "New password must be NULL");
  const locations = await client.query(
    "select location from logistics_approver_locations where profile_id = $1 order by location",
    [profile.id],
  );
  assert.deepEqual(locations.rows.map(row => row.location), JAVED.locations,
    "Existing assignments must not be changed by provisioning");
  return profile;
}

export async function provisionJaved(client, { apply = false, confirmation } = {}) {
  if (apply) assert.equal(confirmation, CONFIRMATION, "Explicit apply confirmation required");
  await client.query(apply ? "begin" : "begin read only");
  try {
    if (apply) {
      // Protect against a concurrent differently-cased email or employee edit.
      await client.query("lock table profiles, employees, logistics_approver_locations in share row exclusive mode");
    }
    const before = await protectedState(client);
    const employees = await client.query(
      "select id, full_name, role, is_active from employees where badge = $1", [JAVED.badge],
    );
    assert.equal(employees.rows.length, 1, "Employee badge 1444 must exist exactly once");
    assert.equal(employees.rows[0].full_name, JAVED.fullName, "Employee identity mismatch");
    assert.equal(employees.rows[0].role, "other_employee", "Employee role must remain other_employee");
    assert.equal(employees.rows[0].is_active, true, "Employee must still be active");
    const existing = await profileState(client);
    let status;
    if (existing.length) {
      // A previously completed operation is a NO-OP, even after password setup.
      // All conflicting/duplicate identities are refused; never upsert.
      await assertAligned(client, existing);
      status = "already_aligned_no_changes";
    } else if (!apply) {
      status = "would_create_one_profile_and_one_assignment";
    } else {
      const inserted = await client.query(`
        insert into profiles (full_name, email, role, is_active, password_hash)
        values ($1, $2, 'logistics_approver', true, NULL) returning id
      `, [JAVED.fullName, JAVED.email]);
      assert.notEqual(inserted.rows[0].id, employees.rows[0].id, "Profile must have its own UUID");
      await client.query(
        "insert into logistics_approver_locations (profile_id, location) values ($1, $2)",
        [inserted.rows[0].id, JAVED.locations[0]],
      );
      await assertAligned(client, await profileState(client), { newlyCreated: true });
      status = "created_one_profile_and_one_assignment";
    }
    assert.deepEqual(await protectedState(client), before, "Protected rows changed; rolling back");
    await client.query("commit");
    return { status, applied: apply && status === "created_one_profile_and_one_assignment" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

export async function runJavedProvisioningCli(args = process.argv.slice(2)) {
  let client;
  try {
    const allowed = ["--dry-run", "--apply", "--confirm=", "--expected-target="];
    assert.ok(args.every(arg => allowed.some(flag => flag.endsWith("=") ? arg.startsWith(flag) : arg === flag)),
      "Unknown argument");
    assert.ok(!(args.includes("--apply") && args.includes("--dry-run")), "Conflicting mode flags");
    for (const prefix of ["--confirm=", "--expected-target="]) {
      assert.ok(args.filter(arg => arg.startsWith(prefix)).length <= 1, "Duplicate argument");
    }
    const apply = args.includes("--apply");
    const confirmation = args.find(arg => arg.startsWith("--confirm="))?.slice("--confirm=".length);
    const expectedTarget = args.find(arg => arg.startsWith("--expected-target="))?.slice("--expected-target=".length);
    assert.ok(expectedTarget, "Explicit --expected-target=host:port/database is required");
    if (apply) assert.equal(confirmation, CONFIRMATION, "Explicit apply confirmation required");
    const databaseUrl = requireDatabaseUrl();
    const url = new URL(databaseUrl);
    assert.ok(["postgres:", "postgresql:"].includes(url.protocol), "PostgreSQL required");
    assert.equal(`${url.hostname}:${url.port || "5432"}${url.pathname}`, expectedTarget, "Target mismatch");
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    console.log(JSON.stringify(await provisionJaved(client, { apply, confirmation })));
  } catch {
    // Connection errors can contain credentials. Do not print error objects.
    console.error("Javed provisioning refused or rolled back. Check target, confirmation, employee identity and duplicate email. No credentials are printed.");
    process.exitCode = 1;
  } finally {
    if (client) await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runJavedProvisioningCli();
}
