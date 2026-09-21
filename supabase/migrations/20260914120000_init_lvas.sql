-- LVAS Phase 1: enums, core tables, profile trigger, RLS
-- Run in Supabase SQL Editor or via `supabase db push`

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('requester', 'approver', 'admin');

create type public.authorization_status as enum (
  'pending',
  'approved',
  'rejected',
  'expired',
  'cancelled'
);

create type public.notification_type as enum (
  'expiry_warning',
  'request_submitted',
  'request_approved',
  'request_rejected'
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'requester',
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_unique unique (email)
);

create index profiles_role_idx on public.profiles (role);
create index profiles_is_active_idx on public.profiles (is_active);

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'requester'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS can call them safely)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;

create or replace function public.is_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'approver'
      and is_active = true
  );
$$;

create or replace function public.is_admin_or_approver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_approver();
$$;

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  make text not null,
  model text not null,
  year integer,
  color text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicles_plate_number_unique unique (plate_number),
  constraint vehicles_year_check check (year is null or (year >= 1980 and year <= 2100))
);

create index vehicles_is_active_idx on public.vehicles (is_active);
create index vehicles_plate_number_idx on public.vehicles (plate_number);

create trigger vehicles_set_updated_at
before update on public.vehicles
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- authorizations
-- ---------------------------------------------------------------------------
create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  requester_id uuid not null references public.profiles (id) on delete restrict,
  approver_id uuid references public.profiles (id) on delete set null,
  status public.authorization_status not null default 'pending',
  start_date date not null,
  end_date date not null,
  duration_label text not null,
  usage_after time not null default time '19:00',
  purpose text,
  rejection_reason text,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint authorizations_date_range_check check (end_date >= start_date),
  constraint authorizations_rejection_reason_check check (
    (status <> 'rejected') or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  )
);

create index authorizations_status_idx on public.authorizations (status);
create index authorizations_end_date_idx on public.authorizations (end_date);
create index authorizations_requester_id_idx on public.authorizations (requester_id);
create index authorizations_vehicle_id_idx on public.authorizations (vehicle_id);
create index authorizations_approver_id_idx on public.authorizations (approver_id);
create index authorizations_pending_created_at_idx
  on public.authorizations (created_at desc)
  where status = 'pending';

create trigger authorizations_set_updated_at
before update on public.authorizations
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  authorization_id uuid references public.authorizations (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  scheduled_for timestamptz,
  sent_at timestamptz,
  -- Optional dedupe key for cron alerts (e.g. "{authorization_id}:2026-09-14")
  dedupe_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where is_read = false;
create index notifications_authorization_id_idx on public.notifications (authorization_id);
create index notifications_scheduled_for_idx
  on public.notifications (scheduled_for)
  where sent_at is null;

create unique index notifications_dedupe_key_unique_idx
  on public.notifications (dedupe_key)
  where dedupe_key is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.authorizations enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles_select_own_or_elevated"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin_or_approver()
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "profiles_admin_update_all"
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "profiles_admin_select_all"
on public.profiles
for select
to authenticated
using (public.is_admin());

-- vehicles
create policy "vehicles_select_authenticated_active_or_admin"
on public.vehicles
for select
to authenticated
using (
  is_active = true
  or public.is_admin()
);

create policy "vehicles_insert_admin"
on public.vehicles
for insert
to authenticated
with check (public.is_admin());

create policy "vehicles_update_admin"
on public.vehicles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "vehicles_delete_admin"
on public.vehicles
for delete
to authenticated
using (public.is_admin());

-- authorizations
create policy "authorizations_select_own_or_elevated"
on public.authorizations
for select
to authenticated
using (
  requester_id = auth.uid()
  or approver_id = auth.uid()
  or public.is_admin_or_approver()
);

create policy "authorizations_insert_requester"
on public.authorizations
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and (
    public.current_user_role() in ('requester', 'admin')
  )
);

create policy "authorizations_update_own_pending_cancel"
on public.authorizations
for update
to authenticated
using (
  requester_id = auth.uid()
  and status = 'pending'
)
with check (
  requester_id = auth.uid()
  and status = 'cancelled'
);

create policy "authorizations_update_approver"
on public.authorizations
for update
to authenticated
using (public.is_approver() or public.is_admin())
with check (public.is_approver() or public.is_admin());

-- notifications
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "notifications_insert_elevated_or_self"
on public.notifications
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin_or_approver()
);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update on public.authorizations to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- ---------------------------------------------------------------------------
-- Seed note (run manually after creating Muteb's auth user):
--   update public.profiles
--   set role = 'approver', full_name = 'Muteb'
--   where email = 'muteb@example.com';
-- ---------------------------------------------------------------------------
