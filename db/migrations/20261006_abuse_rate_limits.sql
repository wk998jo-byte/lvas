-- Shared abuse protection. Apply to Development for review only.
-- Production schema changes must use the reviewed Replit Publish flow.
-- No existing business tables or records are modified.
create table if not exists rate_limit_buckets (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  attempts integer not null check (attempts >= 0),
  expires_at timestamptz not null
);

create index if not exists rate_limit_buckets_expiry_idx
  on rate_limit_buckets (expires_at);
