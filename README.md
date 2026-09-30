# LVAS — Light Vehicles Authorization System

Next.js (App Router) + PostgreSQL for after-hours light vehicle authorizations.

Employees do not sign in. They submit at `/request` and follow a request at `/track` or `/status`. Logistics approvers give the first approval for their project locations. The admin gives the final approval.

## Database

Schema: `db/schema.sql` (standard PostgreSQL, no Supabase Auth/RLS).

```bash
npm run db:init
npm run db:import -- "path/to/json-backup-folder"
npm run db:validate -- "path/to/json-backup-folder"
npm run db:bootstrap-admin
npm run db:bootstrap-logistics
```

Do not commit JSON backups or employee exports.

## Environment

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL`
- `APPROVER_USER_ID` (optional; oldest active admin is used otherwise)
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (login fills an empty admin hash; `npm run db:bootstrap-admin` stores this password)
- `LOGISTICS_APPROVER_PASSWORD` (shared first password for the logistics roster; `npm run db:bootstrap-logistics`)
- `APP_URL` (public site address used in password-reset links)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (password-reset email)
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

`manager_requester`, `supervisor_requester`, and `other_employee` are HR directory categories that control request duration and cooldown. `admin` and `logistics_approver` can sign in. On Replit, set the variables above as Secrets, run `npm run db:init`, import the data backup, then run both bootstrap commands. Do not copy `NODE_TLS_REJECT_UNAUTHORIZED` into production.
