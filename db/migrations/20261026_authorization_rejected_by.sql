-- Portable PostgreSQL migration for an EXISTING Replit / standard LVAS database.
-- Adds an independent rejection actor. authorizations.approver_id remains the
-- location-assigned final Admin and is not rewritten by Logistics rejection.
--
-- Does NOT backfill or rewrite historical rejected rows.
-- Does NOT change employees, vehicles, logistics assignments, or passwords.
--
-- DO NOT run automatically; apply intentionally after review.

alter table authorizations
  add column if not exists rejected_by_id uuid references profiles (id) on delete set null;
