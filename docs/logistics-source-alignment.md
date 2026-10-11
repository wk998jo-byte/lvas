# Final Logistics alignment — SOURCE READY, PRODUCTION NOT EXECUTED

Official locations, in order: Dhahran Base; Asset Department; Facility;
Fabshop-Salsil; Jafurah; MGS; Rastanura; Yanbu; Zuluf.
Matching remains exact. No wildcard, alias, title-derived access, or shared
bootstrap password is supported. Noorah's nine explicit locations are intentional.
Her unknown employee badge/position are left empty, not invented.
Aiyan remains configured for Yanbu, separately from the ten-person official table.

## Prepared Javed-only command

`scripts/bootstrap-logistics-approvers.mjs` now delegates to the safe Javed-only
command. It cannot bootstrap the entire roster or run schema statements.
Neither entry point is a startup/build/publish hook.

With the separately approved target supplied through DATABASE_URL:

```sh
# Default: transaction is READ ONLY; cannot write.
node scripts/provision-javed.mjs --expected-target=HOST:PORT/DATABASE

# Future, separately authorized operation ONLY. Not executed in this work.
node scripts/provision-javed.mjs --expected-target=HOST:PORT/DATABASE \
  --apply --confirm=CREATE_JAVED_ASSET_DEPARTMENT_PROFILE
```

The target must match the connection's host, port and database exactly.
The command does not load `.env` files or print connection/error details.
It requires active employee badge 1444 with the expected name and unchanged
other_employee role, rejects conflicting or case-insensitive duplicate emails,
creates a distinct profile UUID with NULL password and exactly one Asset Department
assignment, and verifies protected rows before committing.
An already identical account is an explicit NO-OP, including after password setup.
It never repairs/overwrites an existing conflicting account.
Any failure rolls back. No other credentials or sessions are changed.
Password onboarding uses the existing password-reset flow after verifying SMTP
delivery and the published APP_URL. The command does not send a reset email.

## Future Production row plan — PREPARE ONLY

Take a fresh private backup and compare current identities/assignments before
executing a separately approved transaction. Abort on unexpected drift.
No schema change or general import/restore is needed.

| Target | Future operation |
| --- | --- |
| Javed | Create active logistics_approver profile with NULL password; add Asset Department only |
| Waqar | Keep Dhahran Base; remove Facility, old Fabshop spelling, Jafurah, MGS, Rastanura, Yanbu, Zuluf |
| Muhammad Anees | Same seven removals; keep Dhahran Base |
| Hermes | Verify Facility only; no write expected |
| Irphan | Replace old Fabshop spelling with Fabshop-Salsil |
| Muhammad Ali | Verify Jafurah only; no write expected |
| Taalam | Verify MGS only; no write expected |
| Alyas | Verify Rastanura only; no write expected |
| Raj | Verify Yanbu only; no write expected |
| Yusuf | Verify Zuluf only; no write expected |
| Noorah | Preserve profile/role/password; replace old Fabshop spelling; add Asset Department; retain the other seven locations |
| Aiyan | No change; Yanbu remains pending a separate business decision |

Against the audited baseline: 14 → 15 profiles, 11 → 12 Logistics profiles,
32 → 20 assignment rows. No other profile, credential, employee, vehicle,
authorization, notification, or session changes are permitted.

The one pending stage-2 Dhahran Base authorization must remain byte-for-byte
unchanged. Its final approval stays with the administrator; location support
does not move it back to stage 1. Do not send notifications about the alignment.

## Controlled future order

1. Review source/tests and approve publishing separately.
2. Take a fresh backup/read-only baseline, including the live request,
   notifications, all identities/credentials/sessions and assignment sets.
3. Coordinate publishing and immediate assignment normalization in a controlled
   window. Source-only publishing does NOT update existing assignments: before
   normalization, old Fabshop assignments cannot receive the new spelling, and
   Waqar/Anees remain broadly assigned in Production. Do not allow new requests
   in that transition window.
4. Apply the narrowly approved Javed operation and other explicit assignment
   changes; verify exact sets and protected-data fingerprints transactionally.
5. Verify reset delivery and let Javed choose his own password.
6. Verify all location boundaries and preserve the existing stage-2 request.

Publishing, Production changes and GitHub pushes have not been performed.
