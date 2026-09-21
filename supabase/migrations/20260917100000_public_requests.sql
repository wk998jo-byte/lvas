-- Public (unauthenticated) authorization requests.
-- A request is now raised either by a signed-in profile (admin) or, from the
-- public form, on behalf of an employee from the HR directory. Public writes go
-- through the service role in server actions, so no anon RLS policy is added.

alter table public.authorizations
  alter column requester_id drop not null;

alter table public.authorizations
  add column if not exists employee_id uuid references public.employees (id) on delete restrict;

alter table public.authorizations
  add column if not exists public_token uuid not null default gen_random_uuid();

alter table public.authorizations
  add column if not exists contact_mobile text;

create unique index if not exists authorizations_public_token_idx
  on public.authorizations (public_token);

create index if not exists authorizations_employee_id_idx
  on public.authorizations (employee_id);

alter table public.authorizations
  drop constraint if exists authorizations_requester_or_employee_check;

alter table public.authorizations
  add constraint authorizations_requester_or_employee_check
  check (requester_id is not null or employee_id is not null);

-- ---------------------------------------------------------------------------
-- Role limits now key off the employee when the request came from the public
-- form, and off the signed-in profile otherwise.
-- ---------------------------------------------------------------------------
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
  if new.employee_id is not null then
    select role into v_role from public.employees where id = new.employee_id;
  else
    select role into v_role from public.profiles where id = new.requester_id;
  end if;

  v_days := public.role_limit_days(v_role);

  -- Admins (and unknown records) are exempt.
  if v_days is null then
    return new;
  end if;

  v_window := (new.end_date - new.start_date) + 1;
  if v_window > v_days then
    raise exception
      'This category allows authorizations of up to % day(s); requested % day(s).',
      v_days, v_window
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
     and v_last > timezone('utc', now()) - make_interval(days => v_days) then
    raise exception
      'This category allows one request every % day(s). Next request allowed on %.',
      v_days,
      to_char((v_last + make_interval(days => v_days))::date, 'YYYY-MM-DD')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;
