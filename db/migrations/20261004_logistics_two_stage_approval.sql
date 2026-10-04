-- Portable PostgreSQL migration for an EXISTING Replit / standard LVAS database.
-- Adds two-stage logistics approval and password-reset storage.
--
-- Safe for a live database that already has employees, vehicles, profiles,
-- authorizations, and notifications.
--
-- Does NOT drop/recreate tables, truncate data, or reset passwords.
-- Does NOT modify employees, vehicles, or existing authorization row values
-- except to add new columns. Existing authorizations get approval_stage = 2
-- so they stay compatible with the current final-approval path.
--
-- DO NOT run automatically; apply intentionally after review.
-- Do NOT re-import the backup. Do NOT re-run admin bootstrap.

-- ---------------------------------------------------------------------------
-- Role
-- ---------------------------------------------------------------------------
alter type user_role add value if not exists 'logistics_approver';

-- ---------------------------------------------------------------------------
-- Password reset tokens (hashed; one-time; expiring)
-- ---------------------------------------------------------------------------
create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint password_reset_tokens_token_hash_unique unique (token_hash)
);

create index if not exists password_reset_tokens_profile_id_idx
  on password_reset_tokens (profile_id);

-- ---------------------------------------------------------------------------
-- Authorizations: two-stage fields
-- ---------------------------------------------------------------------------
alter table authorizations
  add column if not exists location text,
  add column if not exists justification text,
  add column if not exists approval_stage smallint not null default 2,
  add column if not exists first_approver_id uuid references profiles (id) on delete set null,
  add column if not exists first_approved_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'authorizations_approval_stage_check'
  ) then
    alter table authorizations
      add constraint authorizations_approval_stage_check
      check (approval_stage in (1, 2));
  end if;
end $$;

create index if not exists authorizations_pending_stage_location_idx
  on authorizations (approval_stage, location)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Logistics approver location assignments
-- ---------------------------------------------------------------------------
create table if not exists logistics_approver_locations (
  profile_id uuid not null references profiles (id) on delete cascade,
  location text not null,
  primary key (profile_id, location)
);
