/**
 * Focused checks for Saudi business dates and inclusive duration.
 * Usage: node scripts/test-business-date.mjs
 */
import assert from "node:assert/strict";
import {
  FIXED_USAGE_AFTER,
  addCalendarDays,
  isOnOrAfterSaudiToday,
  saudiTodayIsoDate,
} from "../lib/business-date.ts";
import { inclusiveDayCount } from "../lib/dates.ts";

function atUtc(iso) {
  return new Date(iso);
}

// 00:30 Asia/Riyadh = 21:30 UTC previous day
assert.equal(
  saudiTodayIsoDate(atUtc("2026-09-21T21:30:00.000Z")),
  "2026-09-22",
  "00:30 Saudi must be 22 Sep, not UTC 21 Sep",
);

// 02:30 Asia/Riyadh = 23:30 UTC previous day
assert.equal(
  saudiTodayIsoDate(atUtc("2026-09-21T23:30:00.000Z")),
  "2026-09-22",
  "02:30 Saudi must be 22 Sep, not UTC 21 Sep",
);

// After 03:00 Saudi, UTC date matches
assert.equal(
  saudiTodayIsoDate(atUtc("2026-09-22T00:00:00.000Z")),
  "2026-09-22",
);

assert.equal(isOnOrAfterSaudiToday("2026-09-21", atUtc("2026-09-21T21:30:00.000Z")), false);
assert.equal(isOnOrAfterSaudiToday("2026-09-22", atUtc("2026-09-21T21:30:00.000Z")), true);

assert.equal(inclusiveDayCount("2026-09-22", "2026-09-25"), 4);
assert.equal(addCalendarDays("2026-09-25", 1), "2026-09-26");
assert.equal(FIXED_USAGE_AFTER, "19:00:00");

console.log("business-date: PASS");
