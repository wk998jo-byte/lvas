/**
 * Add logistics first-approver accounts and location assignments.
 * Safe to re-run: existing non-null password hashes are never overwritten.
 * Does not print the password.
 *
 * Apply db/migrations/20261004_logistics_two_stage_approval.sql first on an
 * existing Replit database. Do not re-import the backup or re-bootstrap admin.
 *
 * Requires DATABASE_URL and LOGISTICS_APPROVER_PASSWORD.
 * Usage: node scripts/bootstrap-logistics-approvers.mjs
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const scrypt = promisify(scryptCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const password = process.env.LOGISTICS_APPROVER_PASSWORD;
if (!password) {
  console.error("LOGISTICS_APPROVER_PASSWORD is required.");
  process.exit(1);
}

const PROJECT_LOCATIONS = [
  "Dhahran Base",
  "Facility",
  "Fabshop-Salasil",
  "Jafurah",
  "MGS",
  "Rastanura",
  "Yanbu",
  "Zuluf",
];

const roster = JSON.parse(
  await readFile(path.join(root, "lib/approvals/logistics-roster.json"), "utf8"),
);

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();

try {
  await client.query(`
    alter type user_role add value if not exists 'logistics_approver'
  `);
  await client.query(`
    alter table authorizations
      add column if not exists location text,
      add column if not exists justification text,
      add column if not exists approval_stage smallint not null default 2,
      add column if not exists first_approver_id uuid references profiles (id) on delete set null,
      add column if not exists first_approved_at timestamptz
  `);
  await client.query(`
    do $$
    begin
      if not exists (
        select 1 from pg_constraint where conname = 'authorizations_approval_stage_check'
      ) then
        alter table authorizations
          add constraint authorizations_approval_stage_check
          check (approval_stage in (1, 2));
      end if;
    end $$;
  `);
  await client.query(`
    create index if not exists authorizations_pending_stage_location_idx
      on authorizations (approval_stage, location)
      where status = 'pending'
  `);
  await client.query(`
    create table if not exists logistics_approver_locations (
      profile_id uuid not null references profiles (id) on delete cascade,
      location text not null,
      primary key (profile_id, location)
    )
  `);

  for (const person of roster) {
    const email = person.email.trim().toLowerCase();
    const locations = person.locations.includes("*")
      ? PROJECT_LOCATIONS
      : person.locations;

    const upserted = await client.query(
      `
        insert into profiles (full_name, email, role, department, is_active, password_hash)
        values ($1, $2, 'logistics_approver', $3, true, $4)
        on conflict (email) do update set
          full_name = excluded.full_name,
          role = 'logistics_approver',
          department = excluded.department,
          is_active = true,
          password_hash = coalesce(profiles.password_hash, excluded.password_hash)
        returning id
      `,
      [person.fullName, email, person.position, passwordHash],
    );
    const profileId = upserted.rows[0].id;
    await client.query(
      `delete from logistics_approver_locations where profile_id = $1`,
      [profileId],
    );
    for (const location of locations) {
      await client.query(
        `
          insert into logistics_approver_locations (profile_id, location)
          values ($1, $2)
          on conflict do nothing
        `,
        [profileId, location],
      );
    }
    console.log(`Ready: ${email} · badge ${person.badge} · ${locations.length} location(s)`);
  }
} finally {
  await client.end();
}
