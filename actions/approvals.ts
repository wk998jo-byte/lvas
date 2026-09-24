"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth/guards";
import { activeAuthorizationError } from "@/lib/authorizations/overlap";
import { isOverlapViolation, pgErrorMessage } from "@/lib/db/pool";
import {
  approvePendingAuthorization,
  cancelApprovedAuthorization,
  findApprovedOverlappingAuthorization,
  getAuthorizationById,
  getVehicleById,
  insertNotification,
  rejectPendingAuthorization,
} from "@/lib/db/queries";
import {
  authorizationIdSchema,
  rejectAuthorizationSchema,
} from "@/lib/validations";
import type { Authorization } from "@/types/database";

function revalidateApprovalPaths(id: string) {
  revalidatePath("/history");
  revalidatePath(`/history/${id}`);
  revalidatePath("/", "layout");
}

async function vehicleLabel(vehicleId: string): Promise<string> {
  const data = await getVehicleById(vehicleId);
  return data?.plate_number ?? "vehicle";
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
  const profile = await requireRole("admin");
  const parsed = authorizationIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid authorization id");
  }

  try {
    const current = await getAuthorizationById(parsed.data.id);
    if (!current || current.status !== "pending") {
      return fail("Only pending requests can be approved");
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

    const plate = await vehicleLabel(data.vehicle_id);
    await notifyRequester({
      userId: data.requester_id,
      authorizationId: data.id,
      type: "request_approved",
      title: "Authorization approved",
      body: `Your request for ${plate} (${data.start_date} → ${data.end_date}) was approved.`,
    });

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch (error) {
    if (isOverlapViolation(error)) {
      return fail(
        "Vehicle has an active authorization for overlapping dates.",
      );
    }
    return fail(pgErrorMessage(error));
  }
}

export async function rejectAuthorization(
  input: unknown,
): Promise<ActionResult<Authorization>> {
  const profile = await requireRole("admin");
  const parsed = rejectAuthorizationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid rejection data");
  }

  try {
    const data = await rejectPendingAuthorization({
      id: parsed.data.id,
      approverId: profile.id,
      rejectedAt: new Date().toISOString(),
      rejectionReason: parsed.data.rejection_reason,
    });
    if (!data) return fail("Only pending requests can be rejected");

    const plate = await vehicleLabel(data.vehicle_id);
    await notifyRequester({
      userId: data.requester_id,
      authorizationId: data.id,
      type: "request_rejected",
      title: "Authorization rejected",
      body: `Your request for ${plate} was rejected: ${parsed.data.rejection_reason}`,
    });

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}

export async function endAuthorization(
  input: unknown,
): Promise<ActionResult<Authorization>> {
  await requireRole("admin");
  const parsed = authorizationIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid authorization id");
  }

  try {
    const data = await cancelApprovedAuthorization(parsed.data.id);
    if (!data) {
      return fail("Only an approved authorization can be ended.");
    }

    revalidateApprovalPaths(data.id);
    return ok(data);
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}
