-- Portable PostgreSQL migration for an EXISTING Replit / standard LVAS database.
-- Adds the optional "extended time" choice: vehicle use starts at 21:00
-- instead of 19:00 on each approved date. usage_after now accepts 19:00 or 21:00.
--
-- Does NOT rewrite existing authorizations; every current row stays 19:00.
-- Does NOT change employees, vehicles, logistics assignments, or passwords.
--
-- Do not re-run 20260922_fixed_usage_after.sql after this migration: it resets
-- every row to 19:00 and restores the 19:00-only check.
--
-- DO NOT run automatically; apply intentionally after review.

alter table authorizations
  drop constraint if exists authorizations_usage_after_fixed_check;

alter table authorizations
  drop constraint if exists authorizations_usage_after_allowed_check;

alter table authorizations
  add constraint authorizations_usage_after_allowed_check
  check (usage_after in (time '19:00', time '21:00'));
