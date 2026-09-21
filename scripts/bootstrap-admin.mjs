/**
 * Set a hashed admin password on an existing imported profile.
 * Does not print the password. Requires ADMIN_BOOTSTRAP_EMAIL and
 * ADMIN_BOOTSTRAP_PASSWORD in the environment.
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
if (!email || !password) {
  console.error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required.");
  process.exit(1);
}

const salt = randomBytes(16);
const derived = await scrypt(password, salt, 64);
const passwordHash = `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;

const client = new pg.Client({ connectionString: requireDatabaseUrl() });
await client.connect();
try {
  const { rows } = await client.query(
    `
      update profiles
      set password_hash = $2, role = 'admin', is_active = true
      where lower(email) = $1
      returning id
    `,
    [email, passwordHash],
  );
  if (!rows[0]) {
    console.error("No matching profile found for ADMIN_BOOTSTRAP_EMAIL.");
    process.exitCode = 1;
  } else {
    console.log("Admin password hash stored for matching profile.");
  }
} finally {
  await client.end();
}
