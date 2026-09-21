-- Split 'requester' into three roles:
--   manager_requester, supervisor_requester, other
-- Existing requesters become 'other'; admins are unchanged.

-- ---------------------------------------------------------------------------
-- 1. Drop objects that depend on current_user_role / the enum
-- ---------------------------------------------------------------------------
drop policy if exists "authorizations_insert_requester" on public.authorizations;
drop function if exists public.current_user_role();

-- ---------------------------------------------------------------------------
-- 2. Rebuild the enum
-- ---------------------------------------------------------------------------
alter table public.profiles alter column role drop default;

alter type public.user_role rename to user_role_old;

create type public.user_role as enum (
  'manager_requester',
  'supervisor_requester',
  'other',
  'admin'
);

alter table public.profiles
  alter column role type public.user_role
  using (
    case role::text
      when 'requester' then 'other'
      else role::text
    end
  )::public.user_role;

alter table public.profiles alter column role set default 'other';

drop type public.user_role_old;

-- ---------------------------------------------------------------------------
-- 3. Recreate dependents with the new values
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

-- New signups default to 'other' until an admin assigns the right category.
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
    'other'
  );
  return new;
end;
$$;

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
    'other',
    'admin'
  )
);
