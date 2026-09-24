/**
 * Code-level checks for vehicle authorization overlap.
 * Usage: node scripts/test-authorization-overlap.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function datesOverlap(startA, endA, startB, endB) {
  return startA <= endB && endA >= startB;
}

// Inclusive date ranges
assert.equal(datesOverlap("2026-09-22", "2026-09-25", "2026-09-22", "2026-09-25"), true);
assert.equal(datesOverlap("2026-09-22", "2026-09-25", "2026-09-25", "2026-09-25"), true);
assert.equal(datesOverlap("2026-09-22", "2026-09-25", "2026-09-26", "2026-09-26"), false);

// F / G
assert.equal(
  datesOverlap("2026-09-22", "2026-09-25", "2026-09-25", "2026-09-27"),
  true,
  "start on previous end date must overlap",
);
assert.equal(
  datesOverlap("2026-09-22", "2026-09-25", "2026-09-26", "2026-09-27"),
  false,
  "start the day after end date must be free",
);

// Past approved range does not conflict with later dates
assert.equal(
  datesOverlap("2026-09-01", "2026-09-03", "2026-09-26", "2026-09-27"),
  false,
);

const overlapHelper = readFileSync(
  path.join(root, "lib/authorizations/overlap.ts"),
  "utf8",
);
assert.match(
  overlapHelper,
  /Vehicle has an active authorization for \$\{conflict\.authorized_to\} until/,
);
assert.doesNotMatch(overlapHelper, /booked|rental|reserved/i);

const triggerSql = readFileSync(
  path.join(root, "db/migrations/20260924_approved_overlap_lock.sql"),
  "utf8",
);
assert.match(triggerSql, /status = 'approved'/);
assert.match(triggerSql, /for update/i);
assert.doesNotMatch(triggerSql, /status in \('pending', 'approved'\)/);

const publicAction = readFileSync(
  path.join(root, "actions/public-requests.ts"),
  "utf8",
);
assert.doesNotMatch(
  publicAction,
  /findOverlappingAuthorization/,
  "public submit must not block on overlap",
);

const approveAction = readFileSync(
  path.join(root, "actions/approvals.ts"),
  "utf8",
);
assert.match(approveAction, /findApprovedOverlappingAuthorization/);
assert.match(approveAction, /endAuthorization/);
assert.match(approveAction, /cancelApprovedAuthorization/);
assert.match(approveAction, /status !== "pending"/);

const queryLayer = readFileSync(path.join(root, "lib/db/queries.ts"), "utf8");
assert.match(queryLayer, /and a\.status = 'approved'/);
assert.match(queryLayer, /cancelApprovedAuthorization/);
assert.doesNotMatch(
  queryLayer.split("findApprovedOverlappingAuthorization")[1]?.slice(0, 800) ?? "",
  /status in \('pending', 'approved'\)/,
);

console.log("authorization-overlap: PASS");
