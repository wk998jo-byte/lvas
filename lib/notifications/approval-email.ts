import { z } from "zod";

import { sendSmtpEmail } from "@/lib/auth/mail";
import {
  getApprovalEmailContext,
  getApprovalEmailRecipient,
  insertApprovalNotificationOnce,
} from "@/lib/db/queries";

type ApprovalEmailEvent = "request_submitted" | "ready_for_final_approval";

type ApprovalEventInput = {
  authorizationId: string;
  event: ApprovalEmailEvent;
  recipientIds: string[];
  title: string;
  body: string;
};

function warn(input: ApprovalEventInput, recipientId: string, reason: string) {
  // Never attach error objects, SMTP responses, addresses, message bodies or URLs.
  console.warn("LVAS approval email event", {
    event: input.event,
    authorizationId: input.authorizationId,
    recipientProfileId: recipientId,
    reason,
  });
}

function approvalUrl(authorizationId: string): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) throw new Error("Approval email base URL is not configured.");
  const base = new URL(configured);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("Invalid approval email base URL.");
  }
  // Authenticated staff page only. Never use the authorization's public_token.
  return new URL(`/history/${encodeURIComponent(authorizationId)}`, base).href;
}

/**
 * Called only AFTER a new workflow event commits. Notification creation claims
 * the event/recipient before SMTP; duplicates never attempt SMTP again.
 * At-most-once attempts intentionally do not retry uncertain/failed delivery.
 */
export async function notifyApprovalEvent(input: ApprovalEventInput): Promise<void> {
  await Promise.all([...new Set(input.recipientIds)].map(async (recipientId) => {
    try {
      const created = await insertApprovalNotificationOnce({
        user_id: recipientId,
        authorization_id: input.authorizationId,
        type: "request_submitted",
        title: input.title,
        body: input.body,
        dedupe_key: `approval:${input.authorizationId}:${input.event}:${recipientId}`,
      });
      if (!created) return;
    } catch {
      warn(input, recipientId, "notification_creation_failed");
      return;
    }

    try {
      const recipient = await getApprovalEmailRecipient({
        profileId: recipientId,
        authorizationId: input.authorizationId,
        role: input.event === "request_submitted" ? "logistics_approver" : "admin",
      });
      if (!recipient || !z.email().safeParse(recipient.email?.trim()).success) {
        warn(input, recipientId, "recipient_ineligible");
        return;
      }
      const context = await getApprovalEmailContext(input.authorizationId);
      if (!context) throw new Error("Authorization context unavailable.");
      const text = [
        input.event === "request_submitted"
          ? "A new vehicle authorization request needs Logistics review."
          : "Logistics approved this request. Final Admin approval is required.",
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
        ...(input.event === "ready_for_final_approval" ? [
          `Logistics approver: ${context.logistics_approver_name ?? "Not available"}`,
          `Logistics approval time: ${context.first_approved_at ?? "Not available"}`,
        ] : []),
        "",
        `Review in LVAS (sign-in required): ${approvalUrl(input.authorizationId)}`,
      ].join("\n");
      await sendSmtpEmail({
        to: recipient.email.trim(),
        subject: input.event === "request_submitted"
          ? "LVAS – New Vehicle Authorization Request"
          : "LVAS – Request Ready for Final Approval",
        text,
      }, { boundedTimeouts: true });
    } catch {
      warn(input, recipientId, "email_attempt_failed");
    }
  }));
}
