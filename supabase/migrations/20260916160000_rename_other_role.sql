-- Rename the 'other' role to 'other_employee'.
-- Guarded so the migration is a no-op when the enum was created with the new
-- label already. Column defaults and policies follow the enum OID, but SQL /
-- plpgsql function bodies are stored as text and must be recreated.

do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typnamespace = 'public'::regnamespace
      and t.typname = 'user_role'
      and e.enumlabel = 'other'
  ) then
    alter type public.user_role rename value 'other' to 'other_employee';
  end if;
end $$;

alter table public.profiles alter column role set default 'other_employee';

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
    'other_employee'
  );
  return new;
end;
$$;

create or replace function public.role_limit_days(p_role public.user_role)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'manager_requester' then 90
    when 'supervisor_requester' then 7
    when 'other_employee' then 1
    else null
  end;
$$;

drop policy if exists "authorizations_insert_requester" on public.authorizations;

create policy "authorizations_insert_requester"
on public.authorizations
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and public.current_user_role() in (
    'manager_requester',
    'supervisor_requester',
    'other_employee',
    'admin'
  )
);
