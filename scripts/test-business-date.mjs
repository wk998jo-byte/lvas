/**
 * Focused checks for Saudi business dates and inclusive duration.
 * Usage: node scripts/test-business-date.mjs
 */
import assert from "node:assert/strict";
import {
  EXTENDED_USAGE_AFTER,
  FIXED_USAGE_AFTER,
  addCalendarDays,
  isExtendedUsageAfter,
  isOnOrAfterSaudiToday,
  normalizeAllowedUsageAfter,
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
assert.equal(EXTENDED_USAGE_AFTER, "21:00:00");
assert.equal(normalizeAllowedUsageAfter("19:00"), FIXED_USAGE_AFTER);
assert.equal(normalizeAllowedUsageAfter("21:00:00"), EXTENDED_USAGE_AFTER);
assert.equal(normalizeAllowedUsageAfter("18:00"), null);
assert.equal(normalizeAllowedUsageAfter("21:30"), null);
assert.equal(normalizeAllowedUsageAfter(null), null);
assert.equal(isExtendedUsageAfter("21:00:00"), true);
assert.equal(isExtendedUsageAfter("19:00:00"), false);

console.log("business-date: PASS");
