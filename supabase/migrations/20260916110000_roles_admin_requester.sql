-- Reduce roles to two: 'requester' and 'admin'.
-- Existing approvers become admins; approving is now an admin capability.

-- ---------------------------------------------------------------------------
-- 1. Migrate data
-- ---------------------------------------------------------------------------
update public.profiles
set role = 'admin'
where role = 'approver';

-- ---------------------------------------------------------------------------
-- 2. Drop policies that depend on the approver helpers / current_user_role
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_elevated" on public.profiles;
drop policy if exists "authorizations_select_own_or_elevated" on public.authorizations;
drop policy if exists "authorizations_insert_requester" on public.authorizations;
drop policy if exists "authorizations_update_approver" on public.authorizations;
drop policy if exists "notifications_insert_elevated_or_self" on public.notifications;

drop function if exists public.is_approver();
drop function if exists public.is_admin_or_approver();
drop function if exists public.current_user_role();

-- ---------------------------------------------------------------------------
-- 3. Rebuild the enum without 'approver'
-- ---------------------------------------------------------------------------
alter table public.profiles alter column role drop default;

alter type public.user_role rename to user_role_old;

create type public.user_role as enum ('requester', 'admin');

alter table public.profiles
  alter column role type public.user_role
  using role::text::public.user_role;

alter table public.profiles alter column role set default 'requester';

drop type public.user_role_old;

-- ---------------------------------------------------------------------------
-- 4. Recreate role helpers
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

-- ---------------------------------------------------------------------------
-- 5. Recreate policies against is_admin() only
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_elevated"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
);

create policy "authorizations_select_own_or_elevated"
on public.authorizations
for select
to authenticated
using (
  requester_id = auth.uid()
  or approver_id = auth.uid()
  or public.is_admin()
);

create policy "authorizations_insert_requester"
on public.authorizations
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and status = 'pending'
  and public.current_user_role() in ('requester', 'admin')
);

create policy "authorizations_update_approver"
on public.authorizations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "notifications_insert_elevated_or_self"
on public.notifications
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin()
);
