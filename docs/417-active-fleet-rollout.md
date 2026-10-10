# LVAS 417 Active Fleet Production Rollout Preparation

Preparation only, 10 October 2026. **No Production writes, migrations, imports,
merge, or publish are authorized by this preparation. PR #10 remains draft.**

## Approved scope

The business explicitly approved all **417 previously audited READY missing
006 vehicles as `is_active = TRUE`**. The **20 review vehicles are excluded**.
This availability decision does not change source statuses: 61 supplied statuses
and 356 UNKNOWN statuses are retained in notes. No plate, year, status, or identity
is invented. The 417 approved records happen to all have supplied plates; the
one genuinely plate-less missing source vehicle remains in the review set.

Expected totals: **326 → 743 vehicles**, **325 → 742 006 Doors**. All existing
vehicles, including the legacy `5546` record, remain unchanged.

## Private data and approval integrity

`scripts/prepare-production-fleet-006.mjs` is offline: it checks the pinned workbook
hash, complete original-vehicle hash, exact READY projection hash, 417 active
records and exclusion of all 20 review records before writing. Arbitrary/public
output paths and symlinks are rejected. Output must be Git-ignored and excluded
from deployment. Directory permissions are 0700; output files are 0600.

The only payload fields are `door_number`, `plate_number`, `make`, `model`,
`year`, `notes`, and `is_active`. Source metadata/status/chassis are retained in
notes. The payload is not committed:

`generated-artifacts/fleet-006/rollout/production-payload.json`

Public `scripts/fleet-006-approval.mjs` holds only approved counts and SHA-256
fingerprints, not fleet records, connection strings, or credentials. Timestamp
comparison preserves PostgreSQL microseconds rather than silently truncating
them to JavaScript milliseconds.

## Current read-only Production preflight

| Check | Result |
|---|---|
| Total vehicles | 326 |
| 006 Door Numbers | 325 |
| Door text column | Present, nullable for legacy data |
| Plate nullable now | NO |
| Door uniqueness | Valid, ready, immediate unique non-null Door index |
| Plate uniqueness | Valid, ready, immediate unique plate index; NULLs distinct |
| Unexpected READY Doors already present | 0 |
| READY plate collisions | 0 |
| Unexpected vehicle INSERT triggers/rules | 0 |
| Original 326 UUIDs/complete fields | Pinned baseline matches |

A fresh managed-Production SELECT captured vehicles, all 14 authorization
vehicle links, columns, index properties, INSERT side effects and actual SQL
plate-collision comparison. The shared inspection logic validated this evidence.
The private evidence is not committed.

Future operator preflight:

```sh
node scripts/fleet-006-preflight.mjs /private/production-payload.json
```

It starts `REPEATABLE READ READ ONLY`, performs only SELECTs and commits/rolls
back the read-only transaction. It never attempts inserts, even for a dry run.
Any count, complete baseline-field, UUID, integrity, uniqueness or READY conflict
difference aborts. Nullability is reported; the separate schema step must complete
before the import runner can write.

## Exact supported nullable-plate schema step — NOT executed

Production is Replit-managed PostgreSQL. After separate explicit rollout approval,
use the project's development schema/migration flow and the supported Publish
schema-diff review. Confirm the only intended Production schema alteration is:

```sql
ALTER TABLE public.vehicles
ALTER COLUMN plate_number DROP NOT NULL;
```

Do not use the Publish overwrite-data option. Existing stored plate values,
UUIDs, the unique plate index, and the non-null Door unique index must remain
unchanged. Multiple NULL plates become possible. The existing migration file is
for Development/disposable use only; **do not point a custom migration script at
managed Production**. There is no deploy hook or startup DDL in this release.
No development or Production schema changes were made during this preparation;
the migration was executed only in disposable PostgreSQL.

## Dedicated future Production DML runner

`scripts/import-production-fleet-006.mjs` is separate from the unchanged
disposable-only importer. Merely invoking it runs read-only preflight. It is
not called by application startup, deployment, or migration.

Only after future explicit user approval, an operator may provide the correct
write-capable target through the secrets mechanism and manually invoke:

```sh
node scripts/import-production-fleet-006.mjs /private/production-payload.json \
  --apply --confirm=IMPORT-417-ACTIVE-006 \
  --target=approved-host:approved-port/approved-database
```

The target must match the connected client's host, port and database exactly.
The pinned approval must match; NOT NULL plate schemas are refused. The runner
does **no schema migration**.

One serializable transaction obtains the same advisory lock as the disposable
importer and briefly blocks writes on vehicles/authorizations/profiles/Logistics
assignments. Locks time out after five seconds; statements after thirty seconds.
Plan this brief write pause for the approved execution window.

It rechecks preflight under locks, uses parameterized INSERTs only and explicitly
sets `is_active=true`. No UPDATE, DELETE, authorization/profile/assignment DML or
UUID replacement exists. Unexpected conflicts abort and roll back all inserts.
Original vehicles and related rows are checked again before commit.

A second run skips all 417 only when the entire exact approved payload already
exists, all original 326 records still match and totals are exactly 743/742.
Partial imports, changed imported fields, unrelated extra vehicles, or new
conflicting plates stop. Strict read-only preflight after completed import also
stops on already-present READY Doors; verified rerun handling is exclusive to
the dedicated importer. Never weaken the existing disposable importer guard.

## Disposable simulation and verification

- Exact future runner after nullable migration: **743 total, 742 006, 417 new
  active, zero duplicate Doors, 20 review records absent**.
- Original 326 complete vehicle rows/UUIDs/timestamps preserved, including
  PostgreSQL microseconds.
- All 14 actual snapshot authorization UUID relationships preserved.
- Synthetic profiles and Logistics assignments unchanged.
- Second run: **zero inserted, 417 skipped**, including unchanged imported UUIDs.
- Uniqueness fault at insert eight: all earlier inserts rolled back.
- Wrong target/confirmation, tampered payload, changed baseline, partial import,
  missing unique constraint and unmigrated schema rejected.
- All 417 approved vehicles returned by the actual active-vehicle query and
  searchable using the shared Door matcher. Previously active original vehicles
  remain selectable.
- Separate full-READY nullable integration suite: actual admin/public request,
  authorization, pass/tracking/gate and token/URL-only QR **PASS**. Synthetic
  plate-less probes are separate from the real approved payload.
- All nine existing regression suites **PASS**, including approval, overlap,
  business dates, effective status, Door Number, gate, Logistics scope, atomic
  rate limiting and password hashing.
- `npm run build`: **PASS**. Focused new-script lint: **PASS**.
- Separate static runner review performed. Its generator integrity/privacy and
  complete snapshot-evidence findings were addressed and verified with targeted
  rejection tests and the strengthened full simulation. The review was not
  rerun; no claim of a second independent approval is made.

## Execution boundary

**Ready for controlled Production rollout preparation: YES.**
Execution remains gated by a new explicit user instruction, fresh strict
preflight, supported nullable schema review and post-schema preflight. Leave
PR #10 unmerged until instructed. **Production writes: ZERO.**
