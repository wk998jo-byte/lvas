# LVAS — Light Vehicles Authorization System

Next.js (App Router) + PostgreSQL for after-hours light vehicle authorizations.

Employees do not sign in. They submit at `/request` and follow a request at `/track` or `/status`. Logistics approvers give the first approval for their project locations. The admin gives the final approval.

## Database

Schema: `db/schema.sql` (standard PostgreSQL, no Supabase Auth/RLS).

Use **one** of the two paths below. The live Replit databases already have employees, vehicles, profiles, authorizations, and notifications. Those databases are **not** a fresh install.

### Fresh install only

Use this path only for an empty database. Do **not** use it on the existing Replit LVAS.

```bash
npm run db:init
npm run db:import -- "path/to/json-backup-folder"
npm run db:bootstrap-admin
npm run db:bootstrap-logistics
```

### Existing Replit LVAS

The live databases already contain business data. Do **not** re-import the backup. Do **not** run admin bootstrap again.

1. Apply `db/migrations/20261004_logistics_two_stage_approval.sql` to the existing PostgreSQL database.
2. Set the required Secrets (see Environment).
3. Run `npm run db:bootstrap-logistics` once (safe to re-run later; existing passwords are preserved).
4. Do **not** run `npm run db:import`.
5. Do **not** run `npm run db:bootstrap-admin`.

Do not commit JSON backups or employee exports.

## Environment

Copy `.env.example` to `.env.local` (or set Replit Secrets). Placeholders only — never commit real values.

Preserve:

- `DATABASE_URL`
- `CRON_SECRET` (optional locally; required in production for `/api/cron/expiry-alarms`)

New for logistics and password reset:

- `LOGISTICS_APPROVER_PASSWORD` (initial password for **new** logistics accounts, or profiles whose `password_hash` is still null)
- `APP_URL` (public site address used in password-reset links)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

Also used by a fresh admin bootstrap only:

- `APPROVER_USER_ID` (optional; oldest active admin is used otherwise)
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`

Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` in production.

## Scripts

```bash
npm run dev
npm run build
npm start          # binds 0.0.0.0 and respects PORT (Replit)
npm run lint
```

Historical Supabase SQL lives under `supabase/migrations/` for reference only and is not used at runtime.

## Roles

`manager_requester`, `supervisor_requester`, and `other_employee` are HR directory categories that control request duration and cooldown. `admin` and `logistics_approver` can sign in.
