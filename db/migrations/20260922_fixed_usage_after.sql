-- Portable PostgreSQL migration for Replit / standard Postgres.
-- Fixes after-hours policy: every authorization is after 19:00.
--
-- Does NOT drop/recreate tables, truncate data, or reset passwords.
-- Does NOT modify employees, vehicles, or profiles.
-- Aligns authorizations.usage_after only, then adds a check constraint.
--
-- DO NOT run automatically; apply intentionally after review.

update authorizations
set usage_after = time '19:00'
where usage_after is distinct from time '19:00';

alter table authorizations
  drop constraint if exists authorizations_usage_after_fixed_check;

alter table authorizations
  add constraint authorizations_usage_after_fixed_check
  check (usage_after = time '19:00');
