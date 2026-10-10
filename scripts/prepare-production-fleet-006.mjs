/**
 * Offline preparation only. No database connection or env files.
 * ready.json audit.json fresh-snapshot.json private-output-directory
 * Writes private payload + aggregate integrity manifest, never imports.
 */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, lstatSync, realpathSync, chmodSync, constants } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { validateReady } from "./import-fleet-006.mjs";
import { fingerprint, vehicleFingerprint } from "./fleet-006-integrity.mjs";
import { APPROVAL } from "./fleet-006-approval.mjs";
import { validatePayload } from "./fleet-006-preflight.mjs";

const [readyFile, auditFile, snapshotFile, output] = process.argv.slice(2);
const read = file => JSON.parse(readFileSync(file, "utf8"));
const ready = validateReady(read(readyFile));
const audit = read(auditFile), snapshot = read(snapshotFile);
assert.equal(ready.length, 417);
assert.equal(fingerprint(ready), fingerprint(validateReady(audit.ready_records)));
const review = audit.candidates.filter(c => c.classification === "MISSING — CONFLICT / NEEDS REVIEW");
assert.equal(review.length, 20);
assert.ok(review.every(c => !ready.some(r => r.door_number === c.door_number)));
assert.equal(snapshot.vehicles.length, 326);
assert.equal(snapshot.vehicles.filter(v => v.door_number?.startsWith("006-")).length, 325);
assert.equal(audit.workbook_sha256, APPROVAL.workbookSha256, "Wrong approved workbook");
assert.equal(vehicleFingerprint(snapshot.vehicles), APPROVAL.baselineVehiclesSha256, "Wrong complete baseline");
const payload = ready.map(row => ({
  door_number: row.door_number,
  plate_number: row.plate_number,
  make: row.make,
  model: row.model,
  year: row.year,
  notes: [
    `Asset No: ${row.door_number}`, `Status: ${row.status}`,
    row.category?.length ? `Type: ${row.category.join(", ")}` : null,
    row.chassis ? `Chassis: ${row.chassis}` : null,
    `Source: ${row.sources.map(s => `${s.source_sheet}!${s.source_row}`).join("; ")}`,
  ].filter(Boolean).join(" | "),
  is_active: true, // Explicit business approval, not an inferred source status.
}));
const manifest = {
  approvedCount: 417, excludedReviewCount: 20, baselineCount: 326, baseline006: 325,
  finalCount: 743, final006: 742, payloadSha256: fingerprint(payload),
  baselineVehiclesSha256: vehicleFingerprint(snapshot.vehicles),
  workbookSha256: audit.workbook_sha256,
  approval: "All 417 READY missing 006 vehicles is_active=TRUE; exclude 20 review records",
};
validatePayload(payload); // Compare the pinned approval BEFORE any output.
const appRoot = realpathSync(path.resolve(import.meta.dirname, ".."));
const privateDirectory = path.join(appRoot, "generated-artifacts/fleet-006/rollout");
assert.equal(path.resolve(output), privateDirectory, "Only the dedicated ignored private directory is allowed");
for (let dir = privateDirectory; dir !== appRoot; dir = path.dirname(dir)) {
  const stat = lstatSync(dir, { throwIfNoEntry: false });
  if (stat) assert.ok(!stat.isSymbolicLink(), "Private directory cannot be a symlink");
}
assert.match(readFileSync(path.join(appRoot, ".replitignore"), "utf8"), /^\/?generated-artifacts\/?$/m,
  "Private directory must also be excluded from deployment");
for (const name of ["production-payload.json", "approval-manifest.json"]) {
  const relative = `generated-artifacts/fleet-006/rollout/${name}`;
  assert.ok(execFileSync("git", ["check-ignore", "--no-index", relative], { cwd: appRoot, encoding: "utf8" }).trim(),
    "Private output must be Git-ignored");
  assert.equal(spawnSync("git", ["ls-files", "--error-unmatch", relative], { cwd: appRoot }).status, 1,
    "Private output must not already be tracked");
  const file = path.join(privateDirectory, name);
  const stat = lstatSync(file, { throwIfNoEntry: false });
  if (stat) assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1,
    "Private output cannot be a symlink or hard link");
}
mkdirSync(privateDirectory, { recursive: true, mode: 0o700 });
chmodSync(privateDirectory, 0o700);
for (const [name, value] of [["production-payload.json", payload], ["approval-manifest.json", manifest]]) {
  const file = path.join(privateDirectory, name);
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600, flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
  });
  chmodSync(file, 0o600);
}
console.log(JSON.stringify({ payloadCount: payload.length, active: 417, reviewIncluded: 0, manifest }));
