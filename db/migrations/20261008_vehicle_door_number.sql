-- Reviewed development/disposable-database migration. Do not execute directly
-- against Replit Production; Production schema changes use the Publish review.
-- Business confirmation: the imported Asset No. is the company Door Number.
-- No vehicle is recreated and no notes, plates or relationships are replaced.
begin;

alter table public.vehicles add column if not exists door_number text;

with candidates as (
  select v.id, valid.door_number
  from public.vehicles v
  cross join lateral (
    select count(*) as match_count, min(m[1]) as door_number
    from regexp_matches(
      coalesce(v.notes, ''),
      '(?:^|\|)[[:space:]]*Asset No:[[:space:]]*([0-9]{3}-[0-9]{2}-[0-9]{3})[[:space:]]*(?=\||$)',
      'gi'
    ) as m
  ) valid
  where v.door_number is null
    and valid.match_count = 1
    -- Do not pick one value out of multiple (including malformed) labels.
    and (select count(*) from regexp_matches(
      coalesce(v.notes, ''), 'Asset[[:space:]]+No[[:space:]]*:', 'gi'
    )) = 1
)
update public.vehicles v
set door_number = candidates.door_number
from candidates
where v.id = candidates.id;

-- A duplicate aborts the transaction rather than silently assigning bad data.
create unique index if not exists vehicles_door_number_unique
  on public.vehicles (door_number) where door_number is not null;

commit;
