import { z } from "zod";

import { effectiveAuthorizationStatus } from "@/lib/authorizations/effective-status";
import { sendSmtpEmail } from "@/lib/auth/mail";
import { saudiTodayIsoDate } from "@/lib/business-date";
import { getExpiryEmailContext, insertExpiryNotificationOnce } from "@/lib/db/queries";
import { approvalUrl } from "@/lib/notifications/approval-email";

export type ExpiryAlertStage = 3 | 0;

/**
 * Set EXPIRY_EMAIL_START_AT to the actual publishing cutover (ISO instant with
 * timezone). Missing/invalid configuration fails closed. Only subsequent Saudi
 * business dates qualify: no activation-day replay, regardless of server restarts.
 * Existing approved authorizations qualify for FUTURE scheduled stages.
 */
export function expiryEmailIsProspective(today: string): boolean {
  const configured = process.env.EXPIRY_EMAIL_START_AT?.trim();
  if (!configured || !z.iso.datetime({ offset: true }).safeParse(configured).success) {
    console.warn("LVAS expiry email activation", {
      reason: configured ? "invalid_activation" : "activation_not_configured",
    });
    return false;
  }
  return today > saudiTodayIsoDate(new Date(configured));
}

type ExpiryNotificationInput = {
  authorizationId: string;
  recipientId: string;
  endDate: string;
  daysLeft: ExpiryAlertStage;
  today: string;
  sentAt: string;
  title: string;
  body: string;
  dedupeKey: string;
  requiresLogistics: boolean;
  allowEmail: boolean;
};

export async function notifyExpiryEvent(input: ExpiryNotificationInput): Promise<{
  created: boolean; attempted: boolean; failed: boolean;
}> {
  const result = { created: false, attempted: false, failed: false };
  const warn = (reason: string) => console.warn("LVAS expiry email event", {
    authorizationId: input.authorizationId,
    recipientProfileId: input.recipientId,
    stage: input.daysLeft,
    reason,
  });
  try {
    result.created = await insertExpiryNotificationOnce({
      userId: input.recipientId, authorizationId: input.authorizationId,
      title: input.title, body: input.body, dedupeKey: input.dedupeKey,
      sentAt: input.sentAt, endDate: input.endDate, requiresLogistics: input.requiresLogistics,
    });
  } catch {
    result.failed = true;
    warn("notification_creation_failed");
    return result;
  }
  if (!result.created || !input.requiresLogistics || !input.allowEmail) return result;
  try {
    // Recheck current status, exact end date, role and live location assignment
    // after winning the persistent claim; no cached/broadcast recipient fallback.
    const context = await getExpiryEmailContext(input);
    if (!context || !z.email().safeParse(context.recipient_email?.trim()).success) {
      warn("recipient_or_authorization_ineligible");
      return result;
    }
    const status = effectiveAuthorizationStatus(context.status, context.end_date, input.today);
    if (status !== "approved") return result;
    const text = [
      input.daysLeft === 3 ? "This authorization expires in 3 days." : "This authorization expires today.",
      "",
      `Requester/employee: ${context.requester_name ?? "Not available"}`,
      ...(context.badge ? [`Badge: ${context.badge}`] : []),
      `Vehicle Door Number: ${context.door_number ?? "Not available"}`,
      ...([context.make, context.model].some(Boolean)
        ? [`Vehicle: ${[context.make, context.model].filter(Boolean).join(" ")}`] : []),
      `Location: ${context.location ?? "Not available"}`,
      `Start date: ${context.start_date}`,
      `End date: ${context.end_date}`,
      `Purpose/justification: ${context.purpose ?? "Not provided"}`,
      `Current authorization status: ${status}`,
      "",
      `Review in LVAS (sign-in required): ${approvalUrl(input.authorizationId)}`,
    ].join("\n");
    result.attempted = true;
    await sendSmtpEmail({
      to: context.recipient_email.trim(),
      subject: input.daysLeft === 3
        ? "LVAS – Vehicle Authorization Expiring Soon"
        : "LVAS – Vehicle Authorization Expires Today",
      text,
    }, { boundedTimeouts: true });
  } catch {
    result.failed = true;
    warn("email_attempt_failed");
  }
  return result;
}
