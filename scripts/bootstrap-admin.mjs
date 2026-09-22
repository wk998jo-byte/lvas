/**
 * Set a hashed admin password on an existing imported profile.
 * Does not print the password.
 * Prefer ADMIN_BOOTSTRAP_EMAIL; if omitted, uses APPROVER_USER_ID.
 * Requires ADMIN_BOOTSTRAP_PASSWORD in the environment.
 *
 * Usage: node scripts/bootstrap-admin.mjs
 */
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadEnvFiles, requireDatabaseUrl } from "./env.mjs";

const scrypt = promisify(scryptCallback);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFiles(root);

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
const approverId = process.env.APPROVER_USER_ID?.trim();

if (!password) {
  console.error("ADMIN_BOOTSTRAP_PASSWORD is required.");
  process.exit(1);
}

if (!email && !approverId) {
  console.error(
    "Set ADMIN_BOOTSTRAP_EMAIL to an existing profile email, or APPROVER_USER_ID.",
  );
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();
try {
  let rows;
  if (email) {
    ({ rows } = await client.query(
      `
        update profiles
        set password_hash = $2, role = 'admin', is_active = true
        where lower(email) = $1
        returning id, email
      `,
      [email, passwordHash],
    ));
  } else {
    ({ rows } = await client.query(
      `
        update profiles
        set password_hash = $2, role = 'admin', is_active = true
        where id = $1::uuid
        returning id, email
      `,
      [approverId, passwordHash],
    ));
  }

  if (!rows[0]) {
    console.error(
      email
        ? "No matching profile found for ADMIN_BOOTSTRAP_EMAIL."
        : "No matching profile found for APPROVER_USER_ID.",
    );
    // Help without dumping full emails: show domains + role only.
    const { rows: existing } = await client.query(
      `
        select
          split_part(email, '@', 2) as domain,
          left(split_part(email, '@', 1), 2) as prefix,
          role
        from profiles
        order by created_at
      `,
    );
    console.error("Existing profiles (masked):");
    for (const row of existing) {
      console.error(`  ${row.prefix}***@${row.domain} (${row.role})`);
    }
    process.exitCode = 1;
  } else {
    console.log("Admin password hash stored for matching profile.");
  }
} finally {
  await client.end();
}
