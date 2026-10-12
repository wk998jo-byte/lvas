/**
 * Generates plain, guarded SQL for MANUAL account alignment. Never connects to
 * any database. No public schema changes. Keep generated SQL and baseline input
 * private under generated-artifacts; never execute against Production here.
 */
import assert from "node:assert/strict";

export const originalLocations = [
  "Dhahran Base", "Asset Department", "Facility", "Fabshop-Salsil", "Jafurah",
  "MGS", "Rastanura", "Yanbu", "Zuluf",
];
export const newLocations = ["Central Workshop", "RMD Salasil Workshop", "Rigmove", "Rental"];
export const protectedTables = [
  "authorizations", "employees", "logistics_approver_locations", "notifications",
  "password_reset_tokens", "profiles", "rate_limit_buckets", "sessions", "vehicles",
];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";

export function fingerprintQuery(table, predicate = "") {
  assert(protectedTables.includes(table), "Protected table allowlist");
  return `SELECT count(*)::int AS row_count,
    encode(sha256(convert_to(coalesce(string_agg(row_to_json(t)::text, E'\\n'
      ORDER BY row_to_json(t)::text COLLATE "C"), ''), 'UTF8')), 'hex') AS fingerprint
    FROM public.${table} t ${predicate}`;
}

export function buildAlignmentSql({ baseline, targets }) {
  assert.equal(targets.length, 4);
  assert.deepEqual(targets.map(t => t.location), newLocations);
  assert.equal(new Set(targets.map(t => t.profile_id)).size, 4);
  assert.equal(new Set(targets.map(t => t.employee_id)).size, 4);
  assert.equal(new Set(targets.map(t => t.email)).size, 4);
  for (const t of targets) {
    assert(uuid.test(t.profile_id) && uuid.test(t.employee_id));
    assert.notEqual(t.profile_id, t.employee_id, "Profiles have independent IDs, as in Javed provisioning");
    assert(/^[^\s@]+@binquraya\.com$/.test(t.email));
    assert(/^\d+$/.test(t.badge));
    assert(t.full_name && t.position);
    assert.equal(t.department, "Logistics Department");
  }
  for (const table of protectedTables) {
    assert(Number.isInteger(baseline[table]?.row_count) && baseline[table].row_count >= 0);
    assert(/^[0-9a-f]{64}$/.test(baseline[table]?.fingerprint));
  }
  for (const [table, count] of Object.entries({
    profiles: 15, logistics_approver_locations: 20, employees: 6311,
    authorizations: 2, notifications: 7,
  })) assert.equal(baseline[table].row_count, count);

  const statements = [
    "-- PRIVATE. Execute this WHOLE file as ONE atomic batch in ONE connection.",
    "-- No passwords, emails, employee edits, public DDL, updates, deletes or upserts.",
    "-- If any pinned baseline has drifted, this batch must refuse; do not bypass guards.",
    "-- employee_id in the temporary plan validates identity only; the existing",
    "-- profiles schema has no employee FK. Separate profile UUIDs follow Javed's model.",
    "BEGIN;",
    "SET LOCAL TIME ZONE 'GMT';",
    "SET LOCAL lock_timeout = '5s';",
    "SET LOCAL statement_timeout = '60s';",
    // ON COMMIT DROP makes statement-by-statement autocommit fail closed:
    // every business INSERT depends on these transaction-local tables.
    "CREATE TEMP TABLE lvas_four_guards (guard_name text PRIMARY KEY, passed boolean NOT NULL CHECK (passed)) ON COMMIT DROP;",
    "CREATE TEMP TABLE lvas_four_targets (profile_id uuid PRIMARY KEY, employee_id uuid UNIQUE NOT NULL, full_name text NOT NULL, badge text NOT NULL, department text NOT NULL, position text NOT NULL, email text UNIQUE NOT NULL, location text UNIQUE NOT NULL) ON COMMIT DROP;",
    `INSERT INTO pg_temp.lvas_four_targets VALUES\n${targets.map(t => "(" +
      [t.profile_id,t.employee_id,t.full_name,t.badge,t.department,t.position,t.email,t.location]
        .map(literal).join(",") + ")").join(",\n")};`,
    `LOCK TABLE ${protectedTables.map(t => "public."+t).join(", ")} IN SHARE ROW EXCLUSIVE MODE;`,
  ];
  const guard = (name, expression) => statements.push(
    `INSERT INTO pg_temp.lvas_four_guards SELECT ${literal(name)}, (${expression});`);
  for (const table of protectedTables) {
    const b = baseline[table];
    guard("pre_"+table,
      `SELECT row_count=${b.row_count} AND fingerprint=${literal(b.fingerprint)} FROM (${fingerprintQuery(table)}) s`);
  }
  guard("pre_active_logistics", "(SELECT count(*) FROM public.profiles WHERE role='logistics_approver' AND is_active)=12");
  guard("pre_exact_employees", `NOT EXISTS (
    SELECT 1 FROM pg_temp.lvas_four_targets t WHERE
    (SELECT count(*) FROM public.employees WHERE badge=t.badge)<>1 OR
    NOT EXISTS (SELECT 1 FROM public.employees e WHERE e.id=t.employee_id AND e.badge=t.badge
      AND e.full_name=t.full_name AND e.department=t.department AND e.position=t.position
      AND e.role='manager_requester' AND e.is_active))`);
  guard("pre_profiles_absent", `NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN pg_temp.lvas_four_targets t
    ON p.id=t.profile_id OR lower(btrim(p.email))=lower(t.email)
      OR lower(btrim(p.full_name))=lower(t.full_name))`);
  guard("pre_locations_absent", `NOT EXISTS (
    SELECT 1 FROM public.logistics_approver_locations l JOIN pg_temp.lvas_four_targets t ON l.location=t.location)
    AND NOT EXISTS (SELECT 1 FROM public.authorizations a JOIN pg_temp.lvas_four_targets t ON a.location=t.location)`);
  guard("pre_original_locations", `NOT EXISTS (
    SELECT 1 FROM public.logistics_approver_locations WHERE location NOT IN (${originalLocations.map(literal).join(",")}))`);
  guard("preflight_complete", "(SELECT count(*) FROM pg_temp.lvas_four_guards WHERE passed)=14");
  statements.push(
    `INSERT INTO public.profiles (id,full_name,email,department,role,is_active,password_hash)
      SELECT t.profile_id,e.full_name,t.email,e.department,'logistics_approver',true,NULL
      FROM pg_temp.lvas_four_targets t JOIN public.employees e ON e.id=t.employee_id
      JOIN pg_temp.lvas_four_guards g ON g.guard_name='preflight_complete' AND g.passed;`,
    `INSERT INTO public.logistics_approver_locations (profile_id,location)
      SELECT t.profile_id,t.location FROM pg_temp.lvas_four_targets t
      JOIN pg_temp.lvas_four_guards g ON g.guard_name='preflight_complete' AND g.passed;`,
  );
  guard("post_counts", `(SELECT count(*) FROM public.profiles)=19
    AND (SELECT count(*) FROM public.profiles WHERE role='logistics_approver' AND is_active)=16
    AND (SELECT count(*) FROM public.logistics_approver_locations)=24`);
  guard("post_new_profiles", `(SELECT count(*) FROM public.profiles p
    JOIN pg_temp.lvas_four_targets t ON p.id=t.profile_id WHERE p.full_name=t.full_name
      AND p.email=t.email AND p.department=t.department AND p.role='logistics_approver'
      AND p.is_active AND p.password_hash IS NULL)=4`);
  guard("post_new_assignments", `(SELECT count(*) FROM public.logistics_approver_locations l
      JOIN pg_temp.lvas_four_targets t ON l.profile_id=t.profile_id)=4
    AND (SELECT count(*) FROM public.logistics_approver_locations l
      JOIN pg_temp.lvas_four_targets t ON l.profile_id=t.profile_id AND l.location=t.location)=4
    AND (SELECT count(*) FROM public.logistics_approver_locations l
      JOIN pg_temp.lvas_four_targets t ON l.location=t.location)=4`);
  for (const table of protectedTables) {
    const b = baseline[table];
    const key = table==="profiles" ? "id" : table==="logistics_approver_locations" ? "profile_id" : null;
    const predicate = key ? `WHERE NOT EXISTS (SELECT 1 FROM pg_temp.lvas_four_targets n WHERE n.profile_id=t.${key})` : "";
    guard("post_preserved_"+table,
      `SELECT row_count=${b.row_count} AND fingerprint=${literal(b.fingerprint)} FROM (${fingerprintQuery(table,predicate)}) s`);
  }
  statements.push(
    "-- Only minimal post-state counts; diagnostic/display queries are kept out of this guarded batch.",
    "SELECT (SELECT count(*) FROM public.profiles) AS profiles, (SELECT count(*) FROM public.profiles WHERE role='logistics_approver' AND is_active) AS active_logistics_approvers, (SELECT count(*) FROM public.logistics_approver_locations) AS assignments;",
    "COMMIT;",
  );
  return statements.join("\n\n")+"\n";
}
