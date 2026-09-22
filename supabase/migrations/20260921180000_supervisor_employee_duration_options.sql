-- Split max authorization window from request cooldown.
-- Supervisor + Other Employee: cooldown 1 day, max window 30 days (1 month).
-- Manager stays 90 / 90. Admin remains exempt.

create or replace function public.role_max_duration_days(p_role public.user_role)
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

create or replace function public.role_cooldown_days(p_role public.user_role)
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

-- Keep the old helper name as an alias for cooldown (legacy callers).
create or replace function public.role_limit_days(p_role public.user_role)
returns integer
language sql
immutable
as $$
  select public.role_cooldown_days(p_role);
$$;

create or replace function public.enforce_request_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_max integer;
  v_cooldown integer;
  v_window integer;
  v_last timestamptz;
begin
  if new.employee_id is not null then
    select role into v_role from public.employees where id = new.employee_id;
  else
    select role into v_role from public.profiles where id = new.requester_id;
  end if;

  v_max := public.role_max_duration_days(v_role);
  v_cooldown := public.role_cooldown_days(v_role);

  -- Admins (and unknown records) are exempt.
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
    from public.authorizations
    where employee_id = new.employee_id
      and status in ('pending', 'approved');
  else
    select max(created_at) into v_last
    from public.authorizations
    where requester_id = new.requester_id
      and status in ('pending', 'approved');
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
