# LVAS Complete 006 Fleet Preparation

Preparation only, 10 October 2026. **Do not merge, migrate Production, import
real vehicles, or republish.** The nullable migration and all write verification
are confined to disposable PostgreSQL.

## Source

Workbook: `Asset_Master_For_General_Use_(3)_1791607610048.xlsx`.
SHA-256 and snapshot fingerprint are included in the private generated audit.
All 11 workbook sheets were inspected using workbook relationships, not guessed
`sheetN.xml` ordering. Source references are actual Excel row numbers.

| Sheet | 006 source rows | Unique 006 Door Numbers |
|---|---:|---:|
| Asset Master Data | 707 | 707 |
| MOBILE-CRANES | 0 | 0 |
| Copy of H-E | 0 | 0 |
| HTV | 0 | 0 |
| LMV | 326 | 325 |
| PUBLIC-TRANSPORT | 72 | 72 |
| LIGHT-EQUIPMENTS | 0 | 0 |
| MACHINES | 0 | 0 |
| CONST-TOOLS | 0 | 0 |
| ATTACHEMENTS | 0 | 0 |
| FMG | 0 | 0 |
| **All sheets, deduplicated union** | **1,105** | **762** |

The workbook includes valid four-digit suffixes; formatting and leading zeros
are preserved. Excel `#N/A` errors are treated as unavailable values, not real
manufacturer/model/year data.

## Production comparison

Fresh read-only snapshot: **326 vehicles**, **325 non-null 006 Door Numbers**.
All 325 Production 006 keys appear somewhere in the complete workbook.

| Classification | Unique vehicles | Classified source rows |
|---|---:|---:|
| ALREADY EXISTS | 325 | 325 |
| MISSING — READY TO IMPORT | 417 | 417 |
| MISSING — CONFLICT / NEEDS REVIEW | 20 | 20 |
| DUPLICATE SOURCE DOOR NUMBER | Overlapping observations, not new vehicles | 343 |

Missing fleet vehicles: **437**. **342 keys** occur more than once across the
source sheets. One key has a duplicate within LMV. Consistent cross-sheet
observations are consolidated. Different vehicles/plates/chassis/make/model are
not reconciled automatically. Existing Door matches remain ALREADY EXISTS even
when their source fields need review; they are excluded from every insert.

## Data completeness — missing vehicles only

| Measure | Count |
|---|---:|
| Supplied plate present in at least one source | 436 |
| No supplied plate in any source | 1 |
| Missing year | 1 |
| Missing make/model in source | 6 |
| Authoritative status supplied | 72 |
| Status UNKNOWN | 365 |

Of 437 missing vehicles, six have no single resolved candidate plate because of
absence or conflicting observations; this is different from the one genuinely
plate-less source record. Missing make/model is held for review because the
existing schema requires trustworthy make and model; no values are invented.
Plate/year absence alone does not block readiness.

READY records: **417**, with **61 supplied statuses** and **356 UNKNOWN statuses**.
The subsequent business decision explicitly approved all 417 as `is_active=true`,
excluding all 20 review records. This is not a guessed source status. See
[417 active rollout preparation](417-active-fleet-rollout.md) for the private
payload, guarded Production DML runner, preflight and verified simulation.

## Complete conflict evidence

The generated private audit enumerates **243 separate conflict/data-quality
items across 198 Door Numbers**, with source values, Production values where
relevant, and sheet/row references. This includes conflicts on existing vehicles,
not just the 20 missing records held for review. The current workbook does not
itself use Door Numbers as registration values; the snapshot still has three
historic Door-as-plate placeholders and the legacy plate `5546` test record.
These are reported and preserved, not cleaned up.

Private downloadable deliverables:

- `generated-artifacts/fleet-006/audit-report.md` — each conflict separately and
  every missing vehicle.
- `generated-artifacts/fleet-006/identity-conflicts.csv` — one conflict per row.
- `generated-artifacts/fleet-006/candidates.csv` — all 762 normalized candidates.
- `generated-artifacts/fleet-006/audit.json` — all 1,105 classified source rows,
  raw plate values, normalized fields, references and fingerprints.
- `generated-artifacts/fleet-006/ready.json` — deterministic 417-record payload.
- `generated-artifacts/fleet-006/complete-report.html` — self-contained full report.

Full workbook/snapshot/fleet datasets are intentionally not committed to the
public source repository or included in deployment files. Only this aggregate
audit, preparation code, migration and tests belong in the release.

## Application

- Nullable plate migration drops only NOT NULL; plate uniqueness and the unique
  non-null Door Number index remain.
- Types/queries accept `string | null`. Blank admin plates become NULL.
- Door remains nullable for legacy/manual records.
- Shared identities display Door first and `Plate unavailable`; labelled
  database fields may display `Unavailable`. No literal `null` or fake plate.
- Historic placeholders are hidden in presentation but preserved by unchanged
  admin edits. New imports reject Door Numbers used as plates.
- Door/plate/make/model search remains separator-insensitive and null-safe.
- Door-only vehicles remain selectable. Dashboard includes Door-only vehicles.
- Request, authorization, tracking, pass and live gate paths support NULL plates.
- QR remains a verification URL containing only the existing token.
- The unsafe old LMV-only generator is disabled, not silently reused.

## Deterministic import preparation

```bash
python3 -B scripts/audit-fleet-006.py \
  /path/to/workbook.xlsx /path/to/read-only-snapshot.json \
  generated-artifacts/fleet-006
```

`scripts/import-fleet-006.mjs` validates READY records, sorts by preserved Door
Number and uses one serializable transaction. It inserts only missing Doors,
uses the partial Door uniqueness index for conflict protection, never updates
vehicles or authorizations, and rolls back on any unexpected plate/other conflict.

The CLI and callable importer deliberately refuse every target except the
dedicated `127.0.0.1:15439/heliumdb` fixture. Production execution is not authorized.
The subsequent dedicated runner is documented in
[417 active rollout preparation](417-active-fleet-rollout.md); the disposable
importer restriction remains unchanged.

Dry-run is the default and performs the real inserts followed by rollback:

```bash
DATABASE_URL=postgresql://postgres@127.0.0.1:15439/heliumdb \
  node scripts/import-fleet-006.mjs \
  generated-artifacts/fleet-006/ready.json /path/to/approved-availability.json
```

The plan is a JSON object mapping each new Door to an explicitly approved
boolean. Its original verification used a clearly synthetic, test-only
availability plan, never business approval. The subsequent explicit approval
of the 417 READY vehicles is documented separately.
Existing Door matches are skipped without changing UUIDs or attributes.

## Verification

- `python3 -B scripts/test-fleet-audit.py`: PASS.
- `scripts/test-fleet-import.mjs`: PASS against a disposable database populated
  from the 326-vehicle snapshot. Multiple NULLs, non-null uniqueness, Door
  uniqueness, real admin create/public request, pass/tracking/gate, URL/token QR,
  transactional rollback, rerun and exact preservation of the original 326
  complete vehicle records and authorization links are asserted.
- All nine existing LVAS regression suites: PASS (abuse protection, approval UX,
  overlap, business dates, effective status, Door Number, gate verification,
  Logistics location access and password hashing).
- `npm run build`: PASS.
- Focused new JavaScript checks: PASS. Whole-repository ESLint has eight
  pre-existing errors outside the requested build/security acceptance checks;
  this release adds no new lint errors.

Browser evidence and the PR link are recorded in the delivered full report.
The regular preview configuration is restored after fixture-only verification.

## Controlled Production rollout

The initial report was **NO**. The subsequent explicit 417-active approval,
strict preflight, guarded runner and full simulation are documented in
[417 active rollout preparation](417-active-fleet-rollout.md). Preparation is
ready; live execution remains unauthorized, all 20 review records stay excluded,
and this PR must remain unmerged until a new explicit instruction.

Existing vehicle updates by the importer: **ZERO**. Production writes: **ZERO**.
Production migration applications, real vehicle imports, merges and republishes:
**ZERO**.
