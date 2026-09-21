-- Protect role / is_active changes so only admins can elevate or disable users.

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change user roles';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only admins can change user active status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileges on public.profiles;

create trigger profiles_protect_privileges
before update on public.profiles
for each row
execute function public.protect_profile_privileges();
