import { createHmac, randomInt } from "node:crypto";
import { headers } from "next/headers";

import { getPool } from "@/lib/db/pool";
import { clientNetwork } from "@/lib/security/client-network";

export const TOO_MANY_ATTEMPTS = "Too many attempts. Please try again later.";
export const SAFE_REQUEST_ERROR = "Unable to process your request. Please try again later.";

const MINUTE = 60_000;
// Counts include in-flight reservations. Successful credential/identity checks
// refund only their own failure reservations, never another request's failures.
// Unverified-network budgets are shared company-wide, not spoofable per-IP keys.
export const RATE_LIMIT_POLICIES = {
  login: { windowMs: 15 * MINUTE, client: 30, fallback: 300, subjectFailures: 8 },
  identityNetwork: { windowMs: 15 * MINUTE, client: 30, fallback: 300 },
  identity: { windowMs: 15 * MINUTE, subjectFailures: 5, combinationFailures: 5 },
  forgotPassword: { windowMs: 60 * MINUTE, client: 20, fallback: 100, subjectRequests: 5 },
  resetPassword: { windowMs: 15 * MINUTE, client: 30, fallback: 300 },
  employeeSearch: { windowMs: MINUTE, client: 60, fallback: 600 },
  tokenTracking: { windowMs: 15 * MINUTE, client: 60, fallback: 600 },
} as const;

type PolicyName = keyof typeof RATE_LIMIT_POLICIES;
type Reservation = { key: string; expiresAt: string };
export type RateLimitPermit =
  | { allowed: false }
  | { allowed: true; refundable: Reservation[] };

function bucketKey(parts: string[]): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Abuse protection configuration unavailable");
  // No raw email, badge, IP, password, ID fragment or reset token is persisted.
  return createHmac("sha256", secret).update(JSON.stringify(parts)).digest("hex");
}

/**
 * Atomic bounded reservation, shared by every Autoscale instance.
 * Upserts lock the bucket rows; a denied bucket rolls back the whole attempt.
 * Stable lock ordering prevents deadlocks across multi-bucket reservations.
 * No startup-time DDL; a missing table/database fails closed.
 */
export async function consumeRateLimit(
  name: PolicyName,
  subject?: string,
): Promise<RateLimitPermit> {
  let client;
  try {
    const network = clientNetwork(await headers());
    const policy: {
      windowMs: number; client?: number; fallback?: number;
      subjectFailures?: number; combinationFailures?: number; subjectRequests?: number;
    } = RATE_LIMIT_POLICIES[name];
    const buckets: { key: string; limit: number; refundable: boolean }[] = [];
    if (policy.client !== undefined) {
      buckets.push({
        key: bucketKey([name, "network", network.identifier]),
        limit: network.trusted ? policy.client : policy.fallback!,
        refundable: false,
      });
    }
    const subjectLimit = policy.subjectFailures ?? policy.subjectRequests;
    if (subjectLimit !== undefined) {
      if (!subject) throw new Error("Missing limiter subject");
      const normalized = subject.trim().toLowerCase();
      buckets.push({
        key: bucketKey([name, "subject", normalized]),
        limit: subjectLimit,
        refundable: policy.subjectFailures !== undefined,
      });
      if (policy.combinationFailures !== undefined) {
        buckets.push({
          key: bucketKey([name, "combination", normalized, network.identifier]),
          limit: policy.combinationFailures,
          refundable: true,
        });
      }
    }

    client = await getPool().connect();
    await client.query("begin");
    const refundable: Reservation[] = [];
    for (const bucket of buckets.sort((a, b) => a.key.localeCompare(b.key))) {
      const result = await client.query<{ expires_at: string }>(
        `
          insert into rate_limit_buckets (bucket_key, attempts, expires_at)
          values ($1, 1, now() + $3 * interval '1 millisecond')
          on conflict (bucket_key) do update
          set attempts = case
                when rate_limit_buckets.expires_at <= now() then 1
                else rate_limit_buckets.attempts + 1 end,
              expires_at = case
                when rate_limit_buckets.expires_at <= now()
                  then now() + $3 * interval '1 millisecond'
                else rate_limit_buckets.expires_at end
          where rate_limit_buckets.expires_at <= now()
             or rate_limit_buckets.attempts < $2
          returning expires_at::text
        `,
        [bucket.key, bucket.limit, policy.windowMs],
      );
      if (!result.rows[0]) {
        await client.query("rollback");
        return { allowed: false };
      }
      if (bucket.refundable) {
        refundable.push({ key: bucket.key, expiresAt: result.rows[0].expires_at });
      }
    }
    // Bounded, indexed cleanup on ~1% of admitted attempts, in the same
    // transaction. SKIP LOCKED avoids delaying concurrent active buckets.
    if (randomInt(100) === 0) {
      await client.query(`
        delete from rate_limit_buckets
        where bucket_key in (
          select bucket_key from rate_limit_buckets
          where expires_at <= now()
          order by expires_at
          limit 500 for update skip locked
        )
      `);
    }
    await client.query("commit");
    return { allowed: true, refundable };
  } catch {
    if (client) await client.query("rollback").catch(() => undefined);
    // Never log SQL parameters, exception details or identifiers.
    return { allowed: false };
  } finally {
    client?.release();
  }
}

export async function refundSuccessfulAttempt(permit: RateLimitPermit): Promise<void> {
  if (!permit.allowed) return;
  // Exact generation match prevents a late success refunding a new window.
  for (const reservation of permit.refundable) {
    try {
      await getPool().query(
        `update rate_limit_buckets set attempts = greatest(0, attempts - 1)
         where bucket_key = $1 and expires_at = $2::timestamptz`,
        [reservation.key, reservation.expiresAt],
      );
    } catch {
      // Conservative: failed refunds leave a temporary count, not an open limit.
    }
  }
}
