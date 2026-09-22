-- Portable PostgreSQL migration for Replit / standard Postgres.
-- Updates request duration vs cooldown limits ONLY.
-- Safe for databases that already contain real LVAS data.
--
-- Rules:
--   manager_requester    -> max 90-day window, one request every 90 days
--   supervisor_requester -> max 30-day window, one request every 1 day
--   other_employee       -> max 30-day window, one request every 1 day
--   admin                -> exempt
--
-- Does NOT drop/recreate tables, truncate data, or modify rows.
-- DO NOT run automatically; apply intentionally after review.

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

-- Keep legacy helper name as an alias for cooldown (older callers).
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
