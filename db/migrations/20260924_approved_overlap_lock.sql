-- Portable PostgreSQL migration for Replit / standard Postgres.
-- Vehicle authorization overlap: only APPROVED rows block another approval.
-- Pending requests do not reserve a vehicle.
-- Locks the vehicle row during an approval write so concurrent approvals
-- of overlapping requests cannot both succeed.
--
-- Does NOT drop/recreate tables, truncate data, or reset passwords.
-- Does NOT modify employees, vehicles, profiles, or authorization rows.
--
-- DO NOT run automatically; apply intentionally after review.

create or replace function prevent_authorization_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from 'approved' then
    return new;
  end if;

  perform 1
  from vehicles
  where id = new.vehicle_id
  for update;

  if exists (
    select 1
    from authorizations a
    where a.vehicle_id = new.vehicle_id
      and a.status = 'approved'
      and a.id is distinct from new.id
      and a.start_date <= new.end_date
      and a.end_date >= new.start_date
  ) then
    raise exception
      'Vehicle has an active authorization for overlapping dates.'
      using errcode = 'exclusion_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists authorizations_prevent_overlap on authorizations;
create trigger authorizations_prevent_overlap
before insert or update on authorizations
for each row
execute function prevent_authorization_overlap();
