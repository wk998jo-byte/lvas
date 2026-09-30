"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions";
import { getDefaultApproverId } from "@/lib/auth/approver";
import {
  addDays,
  cooldownMessage,
  durationExceedsLimit,
  durationLimitMessage,
  getRoleRequestLimit,
} from "@/lib/authorizations/limits";
import {
  FIXED_USAGE_AFTER,
  isOnOrAfterSaudiToday,
} from "@/lib/business-date";
import {
  isCheckViolation,
  isOverlapViolation,
  pgErrorMessage,
} from "@/lib/db/pool";
import {
  getEmployeeByBadge,
  getEmployeeForVerify,
  getLastLimitRequestAt,
  getVehicleById,
  insertAuthorization,
  insertNotification,
  listAuthorizationsByEmployeeId,
  listLogisticsApproverIdsForLocation,
  lookupPublicEmployees,
  type BadgeAuthorizationRow,
  type PublicEmployee,
} from "@/lib/db/queries";
import {
  badgeStatusSchema,
  employeeLookupSchema,
  employeeVerifySchema,
  publicRequestSchema,
} from "@/lib/validations";

export type { PublicEmployee };

const LOOKUP_LIMIT = 8;

function escapeSearch(value: string): string {
  return value.replace(/[,()]/g, " ").trim();
}

export async function lookupEmployees(
  input: unknown,
): Promise<ActionResult<PublicEmployee[]>> {
  const parsed = employeeLookupSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid search");
  }

  const term = escapeSearch(parsed.data.query);
  if (term.length < 3) return ok([]);

  try {
    const data = await lookupPublicEmployees(term, LOOKUP_LIMIT);
    return ok(data);
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}

export async function verifyEmployee(
  input: unknown,
): Promise<ActionResult<PublicEmployee>> {
  const parsed = employeeVerifySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid verification");
  }

  const employee = await findVerifiedEmployee(
    parsed.data.employee_id,
    parsed.data.id_last4,
  );
  if (!employee) {
    return fail("The last 4 digits do not match this employee record.");
  }

  return ok(employee);
}

async function findVerifiedEmployee(
  employeeId: string,
  idLast4: string,
): Promise<PublicEmployee | null> {
  const data = await getEmployeeForVerify(employeeId);
  if (!data) return null;

  const digits = (data.national_id ?? "").replace(/\D/g, "");
  if (digits.length < 4 || digits.slice(-4) !== idLast4) return null;

  return {
    id: data.id,
    badge: data.badge,
    full_name: data.full_name,
    department: data.department,
    position: data.position,
    role: data.role,
  };
}

export type PublicRequestReceipt = {
  token: string;
  reference: string;
};

export async function submitPublicRequest(
  input: unknown,
): Promise<ActionResult<PublicRequestReceipt>> {
  const parsed = publicRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid request data");
  }

  const employee = await findVerifiedEmployee(
    parsed.data.employee_id,
    parsed.data.id_last4,
  );
  if (!employee) {
    return fail("The last 4 digits do not match this employee record.");
  }

  if (!isOnOrAfterSaudiToday(parsed.data.start_date)) {
    return fail("Start date cannot be before today.");
  }

  const approverId = await getDefaultApproverId();
  if (!approverId) {
    return fail(
      "No approver is configured yet. Contact the fleet administrator.",
    );
  }

  const logisticsApproverIds = await listLogisticsApproverIdsForLocation(
    parsed.data.location,
  );
  if (logisticsApproverIds.length === 0) {
    return fail(
      "No logistics approver is configured for this location. Contact the fleet administrator.",
    );
  }

  const limit = getRoleRequestLimit(employee.role);
  if (limit) {
    if (
      durationExceedsLimit(parsed.data.start_date, parsed.data.end_date, limit)
    ) {
      return fail(durationLimitMessage(limit));
    }

    try {
      const lastCreatedAt = await getLastLimitRequestAt(employee.id);
      if (lastCreatedAt) {
        const nextAllowedAt = addDays(new Date(lastCreatedAt), limit.cooldownDays);
        if (nextAllowedAt.getTime() > Date.now()) {
          return fail(cooldownMessage(limit, nextAllowedAt));
        }
      }
    } catch (error) {
      return fail(pgErrorMessage(error));
    }
  }

  try {
    const vehicle = await getVehicleById(parsed.data.vehicle_id);
    if (!vehicle || !vehicle.is_active) {
      return fail("Selected vehicle is not available");
    }
  } catch (error) {
    return fail(pgErrorMessage(error));
  }

  try {
    const data = await insertAuthorization({
      vehicle_id: parsed.data.vehicle_id,
      employee_id: employee.id,
      approver_id: approverId,
      start_date: parsed.data.start_date,
      end_date: parsed.data.end_date,
      duration_label: parsed.data.duration_label,
      usage_after: FIXED_USAGE_AFTER,
      purpose: parsed.data.justification,
      contact_mobile: parsed.data.contact_mobile,
      location: parsed.data.location,
      justification: parsed.data.justification,
    });

    await Promise.all(
      logisticsApproverIds.map((userId) =>
        insertNotification({
          user_id: userId,
          authorization_id: data.id,
          type: "request_submitted",
          title: "New authorization request",
          body: `${employee.full_name} (badge ${employee.badge}) requested a vehicle at ${parsed.data.location} from ${parsed.data.start_date} to ${parsed.data.end_date}.`,
        }),
      ),
    );

    revalidatePath("/", "layout");

    return ok({
      token: data.public_token,
      reference: data.id.slice(0, 8).toUpperCase(),
    });
  } catch (error) {
    if (isOverlapViolation(error)) {
      return fail(
        "Vehicle has an active authorization for those dates. Choose different dates or another vehicle.",
      );
    }
    if (isCheckViolation(error)) {
      return fail(pgErrorMessage(error));
    }
    return fail(pgErrorMessage(error));
  }
}

export type BadgeRequestSummary = {
  token: string;
  reference: string;
  status: BadgeAuthorizationRow["status"];
  startDate: string;
  endDate: string;
  durationLabel: string;
  purpose: string | null;
  rejectionReason: string | null;
  location: string | null;
  approvalStage: number;
  plate: string | null;
  vehicle: string | null;
};

export type BadgeStatusResult = {
  fullName: string;
  badge: string;
  requests: BadgeRequestSummary[];
};

export async function lookupRequestsByBadge(
  input: unknown,
): Promise<ActionResult<BadgeStatusResult>> {
  const parsed = badgeStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid lookup");
  }

  const employee = await getEmployeeByBadge(parsed.data.badge);
  const digits = (employee?.national_id ?? "").replace(/\D/g, "");
  const matches =
    employee !== null &&
    digits.length >= 4 &&
    digits.slice(-4) === parsed.data.id_last4;

  if (!employee || !matches) {
    return fail("Badge number and ID digits do not match.");
  }

  const rows = await listAuthorizationsByEmployeeId(employee.id);
  return ok({
    fullName: employee.full_name,
    badge: employee.badge,
    requests: rows.map((row) => ({
      token: row.public_token,
      reference: row.id.slice(0, 8).toUpperCase(),
      status: row.status,
      startDate: row.start_date.slice(0, 10),
      endDate: row.end_date.slice(0, 10),
      durationLabel: row.duration_label,
      purpose: row.purpose,
      rejectionReason: row.rejection_reason,
      location: row.location,
      approvalStage: row.approval_stage,
      plate: row.plate_number,
      vehicle:
        row.make && row.model ? `${row.make} ${row.model}` : null,
    })),
  });
}
