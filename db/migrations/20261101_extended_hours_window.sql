-- Portable PostgreSQL migration for an EXISTING Replit / standard LVAS database.
-- Replaces the "Need extended time?" question with an "Extended hours" request
-- type: a date range of up to 1 month (30 days) in which vehicle use is allowed
-- from 19:00 to 21:00 only, on each date.
--
-- Adds authorizations.usage_until (null = no end clock, the standard window).
-- Extended-hours rows store usage_after 19:00 and usage_until 21:00.
--
-- Replaces enforce_request_limits(): extended-hours requests are limited to 30
-- days and one request per day, and they do not count toward (or get blocked by)
-- the role's standard cadence (managers: one request every 90 days).
-- Role limits themselves are unchanged.
--
-- Does NOT rewrite existing authorizations. Rows created with the retired
-- question (usage_after 21:00) keep their stored rule, so the 19:00/21:00
-- usage_after check from 20261028_extended_usage_time.sql must stay in place.
-- Apply 20261028_extended_usage_time.sql first if it has not been applied.
--
-- DO NOT run automatically; apply intentionally after review.

alter table authorizations
  add column if not exists usage_until time;

alter table authorizations
  drop constraint if exists authorizations_usage_until_check;

alter table authorizations
  add constraint authorizations_usage_until_check
  check (
    usage_until is null
    or (usage_until = time '21:00' and usage_after = time '19:00')
  );

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
  v_extended boolean;
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

  -- Extended hours (19:00-21:00 on each date) are a separate allowance:
  -- up to 30 days, one request per day.
  v_extended := new.usage_until is not null;
  if v_extended then
    v_max := 30;
    v_cooldown := 1;
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
      and (usage_until is not null) = v_extended
      and id is distinct from new.id;
  else
    select max(created_at) into v_last
    from authorizations
    where requester_id = new.requester_id
      and status in ('pending', 'approved')
      and (usage_until is not null) = v_extended
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
