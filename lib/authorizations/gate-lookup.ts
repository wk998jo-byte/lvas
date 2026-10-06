import { queryOne } from "@/lib/db/pool";
import { evaluateGateAuthorization, gateResult, type GateAuthorizationRow } from "@/lib/authorizations/gate-verification";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { publicTokenSchema } from "@/lib/validations";

/**
 * Always a fresh, parameterized PostgreSQL SELECT. Kept separate from employee
 * tracking and location-scoped dashboard queries. The token is the capability.
 */
export async function getGateVerification(token: string) {
  const parsed = publicTokenSchema.safeParse({ token });
  if (!parsed.success) return gateResult("invalid", "Authorization not found / invalid QR.");
  try {
    const row = await queryOne<GateAuthorizationRow>(`
      select a.id, a.status, a.start_date::text as start_date,
        a.end_date::text as end_date, a.usage_after::text as usage_after, a.location,
        case when v.id is null then null else jsonb_build_object(
          'plate_number', v.plate_number, 'make', v.make, 'model', v.model
        ) end as vehicle,
        case
          when a.employee_id is not null then
            case when e.id is null then null else jsonb_build_object(
              'full_name', e.full_name, 'badge', e.badge
            ) end
          when p.id is not null then jsonb_build_object(
            'full_name', p.full_name, 'badge', null
          )
          else null
        end as requester
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join employees e on e.id = a.employee_id
      left join profiles p on p.id = a.requester_id
      where a.public_token = $1
    `, [parsed.data.token]);
    // Reuse the existing broad token policy only for unknown-token responses.
    // Known QR scans (including cancelled/future passes) never consume tracking
    // or identity budgets. This is response throttling, not a database DoS guard.
    if (!row && !(await consumeRateLimit("tokenTracking")).allowed) {
      return gateResult("unavailable", "Too many attempts. Please try again later.");
    }
    return evaluateGateAuthorization(row);
  } catch {
    // Never return/log SQL errors, tokens, contact information or credentials.
    return gateResult("unavailable", "Unable to verify authorization. Please try again later.");
  }
}
