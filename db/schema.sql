-- LVAS portable PostgreSQL schema (Replit / standard Postgres).
-- No Supabase Auth, RLS, or auth.uid() dependencies.
-- Application code enforces authorization.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum (
      'manager_requester',
      'supervisor_requester',
      'other_employee',
      'admin'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'authorization_status') then
    create type authorization_status as enum (
      'pending',
      'approved',
      'rejected',
      'expired',
      'cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum (
      'expiry_warning',
      'request_submitted',
      'request_approved',
      'request_rejected'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (application-owned login records; no auth.users FK)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  email text not null,
  role user_role not null default 'other_employee',
  department text,
  is_active boolean not null default true,
  password_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_email_unique unique (email)
);

create index if not exists profiles_role_idx on profiles (role);
create index if not exists profiles_is_active_idx on profiles (is_active);

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row
execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- sessions (HttpOnly cookie tokens are hashed here)
-- ---------------------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint sessions_token_hash_unique unique (token_hash)
);

create index if not exists sessions_profile_id_idx on sessions (profile_id);
create index if not exists sessions_expires_at_idx on sessions (expires_at);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  badge text not null,
  full_name text not null,
  national_id text,
  mobile text,
  department text,
  position text,
  role user_role not null default 'other_employee',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employees_badge_unique unique (badge),
  constraint employees_role_not_admin check (role <> 'admin')
);

create index if not exists employees_full_name_idx on employees (full_name);
create index if not exists employees_department_idx on employees (department);
create index if not exists employees_role_idx on employees (role);
create index if not exists employees_is_active_idx on employees (is_active);

drop trigger if exists employees_set_updated_at on employees;
create trigger employees_set_updated_at
before update on employees
for each row
execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- vehicles
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  plate_number text not null,
  make text not null,
  model text not null,
  year integer,
  color text,
  is_active boolean not null default true,
  notes text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vehicles_plate_number_unique unique (plate_number),
  constraint vehicles_year_check check (year is null or (year >= 1980 and year <= 2100))
);

create index if not exists vehicles_is_active_idx on vehicles (is_active);
create index if not exists vehicles_plate_number_idx on vehicles (plate_number);

drop trigger if exists vehicles_set_updated_at on vehicles;
create trigger vehicles_set_updated_at
before update on vehicles
for each row
execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- authorizations
-- ---------------------------------------------------------------------------
create table if not exists authorizations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles (id) on delete restrict,
  requester_id uuid references profiles (id) on delete restrict,
  employee_id uuid references employees (id) on delete restrict,
  public_token uuid not null default gen_random_uuid(),
  contact_mobile text,
  approver_id uuid references profiles (id) on delete set null,
  status authorization_status not null default 'pending',
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
  constraint authorizations_usage_after_fixed_check check (usage_after = time '19:00'),
  constraint authorizations_rejection_reason_check check (
    (status <> 'rejected') or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  ),
  constraint authorizations_requester_or_employee_check check (
    requester_id is not null or employee_id is not null
  )
);

create unique index if not exists authorizations_public_token_idx
  on authorizations (public_token);
create index if not exists authorizations_status_idx on authorizations (status);
create index if not exists authorizations_end_date_idx on authorizations (end_date);
create index if not exists authorizations_requester_id_idx on authorizations (requester_id);
create index if not exists authorizations_employee_id_idx on authorizations (employee_id);
create index if not exists authorizations_vehicle_id_idx on authorizations (vehicle_id);
create index if not exists authorizations_approver_id_idx on authorizations (approver_id);
create index if not exists authorizations_pending_created_at_idx
  on authorizations (created_at desc)
  where status = 'pending';

drop trigger if exists authorizations_set_updated_at on authorizations;
create trigger authorizations_set_updated_at
before update on authorizations
for each row
execute function set_updated_at();

-- Overlap protection without btree_gist (Replit-portable).
-- Only APPROVED authorizations block another overlapping approval.
-- Pending requests do not reserve the vehicle.
-- Vehicle row is locked so two concurrent approvals cannot both succeed.
create or replace function prevent_authorization_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'approved' then
    return new;
  end if;

  perform 1
  from vehicles
  where id = new.vehicle_id
  for update;

  if exists (
    select 1
    from authorizations a
    where a.vehicle_id = new.vehicle_id
      and a.status = 'approved'
      and a.id is distinct from new.id
      and a.start_date <= new.end_date
      and a.end_date >= new.start_date
  ) then
    raise exception
      'Vehicle has an active authorization for overlapping dates.'
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists authorizations_prevent_overlap on authorizations;
create trigger authorizations_prevent_overlap
before insert or update on authorizations
for each row
execute function prevent_authorization_overlap();

-- Per-role request limits:
--   manager_requester    -> max 90-day window, one request every 90 days
--   supervisor_requester -> max 30-day window, one request every 1 day
--   other_employee       -> max 30-day window, one request every 1 day
--   admin                -> exempt

create or replace function role_max_duration_days(p_role user_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'manager_requester' then 90
    when 'supervisor_requester' then 30
    when 'other_employee' then 30
    else null
  end;
$$;

create or replace function role_cooldown_days(p_role user_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'manager_requester' then 90
    when 'supervisor_requester' then 1
    when 'other_employee' then 1
    else null
  end;
$$;

create or replace function role_limit_days(p_role user_role)
returns integer
language sql
immutable
as $$
  select role_cooldown_days(p_role);
$$;

create or replace function enforce_request_limits()
returns trigger
language plpgsql
as $$
declare
  v_role user_role;
  v_max integer;
  v_cooldown integer;
  v_window integer;
  v_last timestamptz;
begin
  if new.employee_id is not null then
    select role into v_role from employees where id = new.employee_id;
  else
    select role into v_role from profiles where id = new.requester_id;
  end if;

  v_max := role_max_duration_days(v_role);
  v_cooldown := role_cooldown_days(v_role);
  if v_max is null or v_cooldown is null then
    return new;
  end if;

  v_window := (new.end_date - new.start_date) + 1;
  if v_window > v_max then
    raise exception
      'This category allows authorizations of up to % day(s); requested % day(s).',
      v_max, v_window
      using errcode = 'check_violation';
  end if;

  if new.employee_id is not null then
    select max(created_at) into v_last
    from authorizations
    where employee_id = new.employee_id
      and status in ('pending', 'approved')
      and id is distinct from new.id;
  else
    select max(created_at) into v_last
    from authorizations
    where requester_id = new.requester_id
      and status in ('pending', 'approved')
      and id is distinct from new.id;
  end if;

  if v_last is not null
     and v_last > timezone('utc', now()) - make_interval(days => v_cooldown) then
    raise exception
      'This category allows one request every % day(s). Next request allowed on %.',
      v_cooldown,
      to_char((v_last + make_interval(days => v_cooldown))::date, 'YYYY-MM-DD')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists authorizations_enforce_request_limits on authorizations;
create trigger authorizations_enforce_request_limits
before insert on authorizations
for each row
execute function enforce_request_limits();

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  authorization_id uuid references authorizations (id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  scheduled_for timestamptz,
  sent_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_id_idx on notifications (user_id);
create index if not exists notifications_user_unread_idx
  on notifications (user_id, created_at desc)
  where is_read = false;
create index if not exists notifications_authorization_id_idx on notifications (authorization_id);
create index if not exists notifications_scheduled_for_idx
  on notifications (scheduled_for)
  where sent_at is null;

create unique index if not exists notifications_dedupe_key_unique_idx
  on notifications (dedupe_key)
  where dedupe_key is not null;
