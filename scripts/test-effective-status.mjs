/**
 * Focused checks for effective authorization expiry.
 * Usage: node scripts/test-effective-status.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function addCalendarDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function effectiveAuthorizationStatus(status, endDate, saudiToday) {
  if (status === "approved" && endDate < saudiToday) return "expired";
  return status;
}

function isEffectivelyApproved(status, endDate, saudiToday) {
  return effectiveAuthorizationStatus(status, endDate, saudiToday) === "approved";
}

const today = "2026-09-26";
const yesterday = addCalendarDays(today, -1);
const tomorrow = addCalendarDays(today, 1);

assert.equal(
  effectiveAuthorizationStatus("approved", yesterday, today),
  "expired",
  "A: approved yesterday is effectively expired",
);
assert.equal(
  effectiveAuthorizationStatus("approved", today, today),
  "approved",
  "B: approved today remains approved through the end date",
);
assert.equal(
  effectiveAuthorizationStatus("approved", tomorrow, today),
  "approved",
  "C: approved tomorrow remains approved",
);
assert.equal(
  effectiveAuthorizationStatus("rejected", yesterday, today),
  "rejected",
  "D: rejected stays rejected",
);
assert.equal(
  effectiveAuthorizationStatus("cancelled", yesterday, today),
  "cancelled",
  "E: cancelled stays cancelled",
);
assert.equal(isEffectivelyApproved("approved", yesterday, today), false);
assert.equal(isEffectivelyApproved("approved", today, today), true);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const helper = readFileSync(
  path.join(root, "lib/authorizations/effective-status.ts"),
  "utf8",
);
assert.match(helper, /status === "approved" && endDate < saudiToday/);

const trackPage = readFileSync(
  path.join(root, "app/(public)/track/[token]/page.tsx"),
  "utf8",
);
assert.match(trackPage, /effectiveAuthorizationStatus/);
assert.match(trackPage, /status === "approved" && vehicle && employee/);

const digitalPass = readFileSync(
  path.join(root, "components/authorizations/digital-pass.tsx"),
  "utf8",
);
assert.match(digitalPass, /isEffectivelyApproved/);
assert.doesNotMatch(digitalPass, /request\.status !== "approved"/);

console.log("effective-status: PASS");
