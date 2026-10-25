-- Portable PostgreSQL migration for an EXISTING Replit / standard LVAS database.
-- Adds the location-scoped final Admin mapping table.
--
-- Does NOT insert mappings, rewrite authorization history, or change
-- employees, vehicles, logistics assignments, notifications, or passwords.
-- Production mappings and pending Rigmove/Rental reassignment are applied
-- only by the guarded private alignment script.
--
-- DO NOT run automatically; apply intentionally after review.

create table if not exists final_approver_locations (
  location text primary key,
  profile_id uuid not null references profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists final_approver_locations_profile_id_idx
  on final_approver_locations (profile_id);

drop trigger if exists final_approver_locations_set_updated_at on final_approver_locations;
create trigger final_approver_locations_set_updated_at
before update on final_approver_locations
for each row
execute function set_updated_at();
