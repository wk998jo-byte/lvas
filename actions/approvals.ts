"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions";
import {
  FINAL_APPROVER_FORBIDDEN,
  FINAL_APPROVER_REQUEST_CONFIG_ERROR,
} from "@/lib/approvals/final-approvers";
import { requireRole } from "@/lib/auth/guards";
import { activeAuthorizationError } from "@/lib/authorizations/overlap";
import { isOverlapViolation, pgErrorMessage } from "@/lib/db/pool";
import {
  advanceToFinalApproval,
  approvePendingAuthorization,
  cancelApprovedAuthorization,
  findApprovedOverlappingAuthorization,
  getAuthorizationById,
  getEligibleFinalApproverById,
  getVehicleById,
  insertNotification,
  listLocationsForApprover,
  rejectPendingAuthorization,
} from "@/lib/db/queries";
import {
  authorizationIdSchema,
  rejectAuthorizationSchema,
} from "@/lib/validations";
import type { Authorization } from "@/types/database";
import { notifyApprovalEvent } from "@/lib/notifications/approval-email";

function revalidateApprovalPaths(id: string) {
  revalidatePath("/history");
  revalidatePath(`/history/${id}`);
  revalidatePath("/", "layout");
}

async function vehicleLabel(vehicleId: string): Promise<string> {
  const data = await getVehicleById(vehicleId);
  return data?.plate_number ?? "vehicle";
}

// The conditional decision UPDATE has already committed. Notification preparation
// and delivery must never turn that saved decision into a reported failure.
async function notifyAfterDecision(deliver: () => Promise<void>): Promise<void> {
  try {
    await deliver();
  } catch {
    console.warn("LVAS decision notification delivery failed");
  }
}

async function notifyRequester(input: {
  userId: string | null;
  authorizationId: string;
  type: "request_approved" | "request_rejected";
  title: string;
  body: string;
}) {
  if (!input.userId) return;

  await insertNotification({
    user_id: input.userId,
    authorization_id: input.authorizationId,
    type: input.type,
    title: input.title,
    body: input.body,
    is_read: false,
    sent_at: new Date().toISOString(),
  });
}

export async function approveAuthorization(
  input: unknown,
): Promise<ActionResult<Authorization>> {
  const profile = await requireRole(["admin", "logistics_approver"]);
  const parsed = authorizationIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid authorization id");
  }

  try {
    const current = await getAuthorizationById(parsed.data.id);
    if (!current || current.status !== "pending") {
      return fail("Only pending requests can be approved");
    }

    if (profile.role === "logistics_approver") {
      if (current.approval_stage !== 1) {
        return fail("This request is already with the final approver.");
      }
      const locations = await listLocationsForApprover(profile.id);
      if (!current.location || !locations.includes(current.location)) {
        return fail("This request is outside your project locations.");
      }
      if (!current.approver_id) {
        return fail(FINAL_APPROVER_REQUEST_CONFIG_ERROR);
      }
      const finalApprover = await getEligibleFinalApproverById(current.approver_id);
      if (!finalApprover) {
        return fail(FINAL_APPROVER_REQUEST_CONFIG_ERROR);
      }

      const data = await advanceToFinalApproval({
        id: current.id,
        approverId: profile.id,
        approvedAt: new Date().toISOString(),
      });
      if (!data) return fail("Only a first-stage request can be approved");

      await notifyAfterDecision(async () => {
        const plate = await vehicleLabel(data.vehicle_id);
        await notifyApprovalEvent({
          authorizationId: data.id,
          event: "ready_for_final_approval",
          recipientIds: [finalApprover.id],
          title: "Request ready for final approval",
          body: `${plate} (${data.start_date} → ${data.end_date}) at ${data.location ?? "the project"} was approved by logistics and is waiting for final approval.`,
        });
      });

      revalidateApprovalPaths(data.id);
      return ok(data);
    }

    if (current.approval_stage !== 2) {
      return fail("Logistics approval is still required.");
    }
    if (current.approver_id !== profile.id) {
      return fail(FINAL_APPROVER_FORBIDDEN);
    }

    const conflict = await findApprovedOverlappingAuthorization({
      vehicleId: current.vehicle_id,
      startDate: current.start_date,
      endDate: current.end_date,
      excludeId: current.id,
    });
    if (conflict) {
      return fail(activeAuthorizationError(conflict));
    }

    const data = await approvePendingAuthorization({
      id: parsed.data.id,
      approverId: profile.id,
      approvedAt: new Date().toISOString(),
    });
    if (!data) return fail("Only pending requests can be approved");

    await notifyAfterDecision(async () => {
      const plate = await vehicleLabel(data.vehicle_id);
      await notifyRequester({
        userId: data.requester_id,
        authorizationId: data.id,
        type: "request_approved",
        title: "Authorization approved",
        body: `Your request for ${plate} (${data.start_date} → ${data.end_date}) was approved.`,
      });
    });

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch (error) {
    if (isOverlapViolation(error)) {
      return fail(
        "Vehicle has an active authorization for overlapping dates.",
      );
    }
    return fail("Unable to approve this request. Please try again.");
  }
}

export async function rejectAuthorization(
  input: unknown,
): Promise<ActionResult<Authorization>> {
  const profile = await requireRole(["admin", "logistics_approver"]);
  const parsed = rejectAuthorizationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid rejection data");
  }

  try {
    const current = await getAuthorizationById(parsed.data.id);
    if (!current || current.status !== "pending") {
      return fail("Only pending requests can be rejected");
    }

    if (profile.role === "logistics_approver") {
      if (current.approval_stage !== 1) {
        return fail("This request is already with the final approver.");
      }
      const locations = await listLocationsForApprover(profile.id);
      if (!current.location || !locations.includes(current.location)) {
        return fail("This request is outside your project locations.");
      }
    } else if (current.approval_stage !== 2) {
      return fail("Logistics approval is still required.");
    } else if (current.approver_id !== profile.id) {
      return fail(FINAL_APPROVER_FORBIDDEN);
    }

    const data = await rejectPendingAuthorization({
      id: parsed.data.id,
      approverId: profile.id,
      rejectedAt: new Date().toISOString(),
      rejectionReason: parsed.data.rejection_reason,
      approvalStage: profile.role === "logistics_approver" ? 1 : 2,
    });
    if (!data) return fail("Only pending requests can be rejected");

    await notifyAfterDecision(async () => {
      const plate = await vehicleLabel(data.vehicle_id);
      await notifyRequester({
        userId: data.requester_id,
        authorizationId: data.id,
        type: "request_rejected",
        title: "Authorization rejected",
        body: `Your request for ${plate} was rejected: ${parsed.data.rejection_reason}`,
      });
    });

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch {
    return fail("Unable to reject this request. Please try again.");
  }
}

export async function endAuthorization(
  input: unknown,
): Promise<ActionResult<Authorization>> {
  const profile = await requireRole("admin");
  const parsed = authorizationIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid authorization id");
  }

  try {
    const current = await getAuthorizationById(parsed.data.id);
    if (!current || current.status !== "approved") {
      return fail("Only an approved authorization can be ended.");
    }
    if (current.approver_id !== profile.id) {
      return fail(FINAL_APPROVER_FORBIDDEN);
    }

    const data = await cancelApprovedAuthorization(parsed.data.id, profile.id);
    if (!data) {
      return fail("Only an approved authorization can be ended.");
    }

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}
