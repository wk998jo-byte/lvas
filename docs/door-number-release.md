# Door Number release review

## Business rule

The imported `Asset No.` values in existing vehicle notes are the official
company Door Numbers. Keep the identifier as text, including leading zeros.
Missing identifiers remain null; vehicles are still selectable.

## Scope and validation

`db/migrations/20261008_vehicle_door_number.sql` is the reviewed,
transactional, rerunnable Development/disposable migration. It adds a nullable
text field, backfills only a single valid labelled identifier, then enforces
non-null uniqueness. It never replaces plates, notes, vehicle IDs or
authorization relationships, and never overwrites a non-null Door Number.

The fresh read-only Production vehicle snapshot was tested in an isolated local
PostgreSQL database: 326 total, 325 populated, 1 null, 0 duplicates. The null
record is plate `5546`. Plate `1-UEU` maps to `006-01-011`, `1296-GVD` to
`006-01-756`, and `8178-URB` to `006-01-736`.

All eight existing regression suites and the focused Door Number suite passed.
`npm run build` passed. GitHub main already has eight unrelated ESLint errors;
this release does not introduce an additional lint error.

## Production boundary

No Production schema/data migration or publishing has been performed.
The PR must remain unmerged pending review.

For Replit-managed PostgreSQL, schema changes are applied through the supported
Publish schema review, not direct Production DDL, startup DDL or deploy hooks.
Publishing a schema change does **not** copy the backfilled Development values
into Production. A separately approved Production data-backfill step is still
required for the 325 existing vehicles. Do not select “overwrite Production data
with Development data.” Preserve Production users, assignments and active flags.
The local backup's active flags differ from the fresh Production snapshot.

After an approved rollout, validate counts, the three example mappings, the
remaining null, non-null uniqueness, unchanged plates/notes/UUID relationships,
both selector searches, tracking/pass display, and live gate lookup. QR content
must remain the live verification URL/token only.

## Reproducing tests

Use an empty disposable PostgreSQL database at `127.0.0.1:5440/lvas_door_test`:

```sh
DATABASE_URL=postgresql://runner@127.0.0.1:5440/lvas_door_test \
  node scripts/test-door-number.mjs
```

An optional JSON fixture argument permits testing the audited vehicle snapshot.
Without it, the suite creates equivalent synthetic vehicle fixtures; no real
vehicle snapshot or account credentials are committed.

The existing database-backed regression suites retain their separate localhost
`15439/heliumdb` disposable database safety checks. Apply the existing schema and
migrations to that disposable database before running them. The approval suite
also requires `LVAS_DISPOSABLE_TEST_DB=1`.
