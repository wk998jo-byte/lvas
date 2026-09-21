# Expiry alarms cron

Daily job should hit the Next.js route:

```http
GET /api/cron/expiry-alarms
Authorization: Bearer $CRON_SECRET
```

Behavior:

- Marks approved authorizations with `end_date < today` as `expired`
- Creates `expiry_warning` notifications for approved authorizations ending in **7**, **3**, or **1** day(s)
- Uses `dedupe_key = {authorization_id}:expiry:{days}` so each threshold fires once

In development, the route allows unauthenticated calls when `CRON_SECRET` is unset.
