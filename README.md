# LVAS — Light Vehicles Authorization System

Next.js (App Router) + PostgreSQL for after-hours light vehicle authorizations.

Employees do not sign in. They submit at `/request`. Administrators sign in and approve or reject requests.

## Database

Schema: `db/schema.sql` (standard PostgreSQL, no Supabase Auth/RLS).

```bash
node scripts/init-db.mjs
node scripts/import-backup.mjs "path/to/json-backup-folder"
node scripts/validate-migration.mjs "path/to/json-backup-folder"
node scripts/bootstrap-admin.mjs
```

Do not commit JSON backups or employee exports.

## Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`
- `APPROVER_USER_ID` (optional; oldest active admin is used otherwise)
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (sets the hash for an imported admin profile that has no password yet)
- `CRON_SECRET` (optional; required in production for `/api/cron/expiry-alarms`)

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

`manager_requester`, `supervisor_requester`, and `other_employee` are HR directory categories that control request duration/cooldown. Only `admin` profiles can sign in.
