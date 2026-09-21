-- Employee directory imported from the HR master sheet.
-- These are not login accounts: `profiles` stays reserved for users who sign in.
-- Each employee carries a requester category so per-role request limits can be
-- applied to the employee a request is raised for.

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  badge text not null,
  full_name text not null,
  national_id text,
  mobile text,
  department text,
  position text,
  role public.user_role not null default 'other_employee',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint employees_badge_unique unique (badge),
  constraint employees_role_not_admin check (role <> 'admin')
);

create index if not exists employees_full_name_idx on public.employees (full_name);
create index if not exists employees_department_idx on public.employees (department);
create index if not exists employees_role_idx on public.employees (role);
create index if not exists employees_is_active_idx on public.employees (is_active);

drop trigger if exists employees_set_updated_at on public.employees;

create trigger employees_set_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

alter table public.employees enable row level security;

drop policy if exists "employees_select_authenticated" on public.employees;
drop policy if exists "employees_insert_admin" on public.employees;
drop policy if exists "employees_update_admin" on public.employees;
drop policy if exists "employees_delete_admin" on public.employees;

create policy "employees_select_authenticated"
on public.employees
for select
to authenticated
using (is_active = true or public.is_admin());

create policy "employees_insert_admin"
on public.employees
for insert
to authenticated
with check (public.is_admin());

create policy "employees_update_admin"
on public.employees
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "employees_delete_admin"
on public.employees
for delete
to authenticated
using (public.is_admin());

grant select, insert, update, delete on public.employees to authenticated;
