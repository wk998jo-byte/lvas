/**
 * Import the data-only JSON backup into PostgreSQL.
 * Does not print national IDs, mobiles, emails, or secrets.
 *
 * Usage:
 *   node scripts/import-backup.mjs "path/to/backup-folder"
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scripts/import-backup.mjs <backup-folder>");
  process.exit(1);
}

function loadTable(name) {
  const file = path.join(backupDir, `${name}.json`);
  if (!existsSync(file)) {
    throw new Error(`Missing ${name}.json in backup folder`);
  }
  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) {
    throw new Error(`${name}.json must be an array`);
  }
  return rows;
}

function chunk(rows, size = 200) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();

const source = {
  profiles: loadTable("profiles"),
  employees: loadTable("employees"),
  vehicles: loadTable("vehicles"),
  authorizations: loadTable("authorizations"),
  notifications: loadTable("notifications"),
};

console.log("Source counts:");
for (const [name, rows] of Object.entries(source)) {
  console.log(`  ${name}: ${rows.length}`);
}

try {
  await client.query("begin");

  for (const row of source.profiles) {
    await client.query(
      `
        insert into profiles (id, full_name, email, role, department, is_active, created_at, updated_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update set
          full_name = excluded.full_name,
          email = excluded.email,
          role = excluded.role,
          department = excluded.department,
          is_active = excluded.is_active,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        row.id,
        row.full_name ?? "",
        row.email,
        row.role,
        row.department ?? null,
        row.is_active ?? true,
        row.created_at,
        row.updated_at,
      ],
    );
  }
  console.log(`Imported profiles: ${source.profiles.length}`);

  for (const group of chunk(source.employees, 250)) {
    for (const row of group) {
      await client.query(
        `
          insert into employees (
            id, badge, full_name, national_id, mobile, department, position,
            role, is_active, created_at, updated_at
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          on conflict (id) do update set
            badge = excluded.badge,
            full_name = excluded.full_name,
            national_id = excluded.national_id,
            mobile = excluded.mobile,
            department = excluded.department,
            position = excluded.position,
            role = excluded.role,
            is_active = excluded.is_active,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
        `,
        [
          row.id,
          row.badge,
          row.full_name,
          row.national_id ?? null,
          row.mobile ?? null,
          row.department ?? null,
          row.position ?? null,
          row.role,
          row.is_active ?? true,
          row.created_at,
          row.updated_at,
        ],
      );
    }
  }
  console.log(`Imported employees: ${source.employees.length}`);

  for (const row of source.vehicles) {
    await client.query(
      `
        insert into vehicles (
          id, plate_number, make, model, year, color, is_active, notes,
          created_by, created_at, updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id) do update set
          plate_number = excluded.plate_number,
          make = excluded.make,
          model = excluded.model,
          year = excluded.year,
          color = excluded.color,
          is_active = excluded.is_active,
          notes = excluded.notes,
          created_by = excluded.created_by,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        row.id,
        row.plate_number,
        row.make,
        row.model,
        row.year ?? null,
        row.color ?? null,
        row.is_active ?? true,
        row.notes ?? null,
        row.created_by ?? null,
        row.created_at,
        row.updated_at,
      ],
    );
  }
  console.log(`Imported vehicles: ${source.vehicles.length}`);

  for (const row of source.authorizations) {
    await client.query(
      `
        insert into authorizations (
          id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
          approver_id, status, start_date, end_date, duration_label, usage_after,
          purpose, rejection_reason, approved_at, rejected_at, created_at, updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        )
        on conflict (id) do update set
          vehicle_id = excluded.vehicle_id,
          requester_id = excluded.requester_id,
          employee_id = excluded.employee_id,
          public_token = excluded.public_token,
          contact_mobile = excluded.contact_mobile,
          approver_id = excluded.approver_id,
          status = excluded.status,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          duration_label = excluded.duration_label,
          usage_after = excluded.usage_after,
          purpose = excluded.purpose,
          rejection_reason = excluded.rejection_reason,
          approved_at = excluded.approved_at,
          rejected_at = excluded.rejected_at,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `,
      [
        row.id,
        row.vehicle_id,
        row.requester_id ?? null,
        row.employee_id ?? null,
        row.public_token,
        row.contact_mobile ?? null,
        row.approver_id ?? null,
        row.status,
        row.start_date,
        row.end_date,
        row.duration_label,
        row.usage_after,
        row.purpose ?? null,
        row.rejection_reason ?? null,
        row.approved_at ?? null,
        row.rejected_at ?? null,
        row.created_at,
        row.updated_at,
      ],
    );
  }
  console.log(`Imported authorizations: ${source.authorizations.length}`);

  for (const row of source.notifications) {
    await client.query(
      `
        insert into notifications (
          id, user_id, authorization_id, type, title, body, is_read,
          scheduled_for, sent_at, dedupe_key, created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        on conflict (id) do update set
          user_id = excluded.user_id,
          authorization_id = excluded.authorization_id,
          type = excluded.type,
          title = excluded.title,
          body = excluded.body,
          is_read = excluded.is_read,
          scheduled_for = excluded.scheduled_for,
          sent_at = excluded.sent_at,
          dedupe_key = excluded.dedupe_key,
          created_at = excluded.created_at
      `,
      [
        row.id,
        row.user_id,
        row.authorization_id ?? null,
        row.type,
        row.title,
        row.body,
        row.is_read ?? false,
        row.scheduled_for ?? null,
        row.sent_at ?? null,
        row.dedupe_key ?? null,
        row.created_at,
      ],
    );
  }
  console.log(`Imported notifications: ${source.notifications.length}`);

  await client.query("commit");
  console.log("Import complete. Run: node scripts/validate-migration.mjs <backup-folder>");
} catch (error) {
  await client.query("rollback");
  console.error("Import failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
