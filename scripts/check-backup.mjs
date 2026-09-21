/**
 * Read-only JSON backup structure check. Prints counts only.
 * Usage: node scripts/check-backup.mjs "path/to/backup-folder"
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scripts/check-backup.mjs <backup-folder>");
  process.exit(1);
}

const expected = {
  profiles: ["id", "email", "role"],
  employees: ["id", "badge", "full_name", "role"],
  vehicles: ["id", "plate_number", "make", "model"],
  authorizations: ["id", "vehicle_id", "status", "public_token", "start_date", "end_date"],
  notifications: ["id", "user_id", "type"],
};

let failed = false;
for (const [table, keys] of Object.entries(expected)) {
  const file = path.join(backupDir, `${table}.json`);
  if (!existsSync(file)) {
    console.error(`${table}: missing file`);
    failed = true;
    continue;
  }
  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) {
    console.error(`${table}: not an array`);
    failed = true;
    continue;
  }
  const missingKeys = rows[0] ? keys.filter((key) => !(key in rows[0])) : [];
  if (missingKeys.length) {
    console.error(`${table}: missing keys ${missingKeys.join(", ")}`);
    failed = true;
  } else {
    console.log(`${table}: ${rows.length} OK`);
  }
}

process.exit(failed ? 1 : 0);
