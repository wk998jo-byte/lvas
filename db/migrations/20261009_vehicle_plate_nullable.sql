-- Reviewed Development/disposable migration only. Production schema changes
-- require the supported Publish schema review and separate user approval.
-- PostgreSQL UNIQUE already permits multiple NULLs; retain the existing
-- plate and Door Number uniqueness guarantees and every existing value/UUID.
begin;
alter table public.vehicles alter column plate_number drop not null;
commit;
