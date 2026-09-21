-- Phase 6: prevent overlapping pending/approved authorizations per vehicle
create extension if not exists btree_gist;

alter table public.authorizations
  drop constraint if exists authorizations_no_vehicle_date_overlap;

alter table public.authorizations
  add constraint authorizations_no_vehicle_date_overlap
  exclude using gist (
    vehicle_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
  where (status in ('pending', 'approved'));
