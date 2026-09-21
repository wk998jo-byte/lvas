-- Per-role request limits (enforced server-side and in the database):
--   manager_requester    -> max 90-day window, one request every 90 days
--   supervisor_requester -> max 7-day window,  one request every 7 days
--   other                -> max 1-day window,  one request every day
--   admin                -> exempt
-- The cooldown counts from the last pending/approved request the user created;
-- rejected and cancelled requests do not consume the allowance.

create or replace function public.role_limit_days(p_role public.user_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'manager_requester' then 90
    when 'supervisor_requester' then 7
    when 'other' then 1
    else null
  end;
$$;

create or replace function public.enforce_request_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_days integer;
  v_window integer;
  v_last timestamptz;
begin
  select role into v_role
  from public.profiles
  where id = new.requester_id;

  v_days := public.role_limit_days(v_role);

  -- Admins (and unknown profiles) are exempt.
  if v_days is null then
    return new;
  end if;

  v_window := (new.end_date - new.start_date) + 1;
  if v_window > v_days then
    raise exception
      'Your role allows authorizations of up to % day(s); requested % day(s).',
      v_days, v_window
      using errcode = 'check_violation';
  end if;

  select max(created_at) into v_last
  from public.authorizations
  where requester_id = new.requester_id
    and status in ('pending', 'approved');

  if v_last is not null
     and v_last > timezone('utc', now()) - make_interval(days => v_days) then
    raise exception
      'Your role can submit one request every % day(s). Next request allowed on %.',
      v_days,
      to_char((v_last + make_interval(days => v_days))::date, 'YYYY-MM-DD')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists authorizations_enforce_request_limits on public.authorizations;

create trigger authorizations_enforce_request_limits
before insert on public.authorizations
for each row
execute function public.enforce_request_limits();
