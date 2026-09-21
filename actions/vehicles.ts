"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, okEmpty, type ActionResult } from "@/lib/actions";
import { requireRole } from "@/lib/auth/guards";
import { isUniqueViolation, pgErrorMessage } from "@/lib/db/pool";
import {
  insertVehicle,
  setVehicleActive,
  updateVehicleRow,
} from "@/lib/db/queries";
import {
  updateVehicleSchema,
  vehicleFormSchema,
  vehicleIdSchema,
} from "@/lib/validations";
import type { Vehicle } from "@/types/database";

function revalidateVehiclePaths() {
  revalidatePath("/vehicles");
}

export async function createVehicle(
  input: unknown,
): Promise<ActionResult<Vehicle>> {
  const profile = await requireRole("admin");
  const parsed = vehicleFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid vehicle data");
  }

  try {
    const data = await insertVehicle({
      ...parsed.data,
      created_by: profile.id,
    });
    revalidateVehiclePaths();
    return ok(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("A vehicle with this plate number already exists");
    }
    return fail(pgErrorMessage(error));
  }
}

export async function updateVehicle(
  input: unknown,
): Promise<ActionResult<Vehicle>> {
  await requireRole("admin");
  const parsed = updateVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid vehicle data");
  }

  const { id, ...fields } = parsed.data;
  try {
    const data = await updateVehicleRow(id, fields);
    if (!data) return fail("Vehicle not found");
    revalidateVehiclePaths();
    revalidatePath(`/vehicles/${id}`);
    return ok(data);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("A vehicle with this plate number already exists");
    }
    return fail(pgErrorMessage(error));
  }
}

export async function deactivateVehicle(
  input: unknown,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = vehicleIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid vehicle id");
  }

  try {
    await setVehicleActive(parsed.data.id, false);
    revalidateVehiclePaths();
    revalidatePath(`/vehicles/${parsed.data.id}`);
    return okEmpty();
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}

export async function reactivateVehicle(
  input: unknown,
): Promise<ActionResult> {
  await requireRole("admin");
  const parsed = vehicleIdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid vehicle id");
  }

  try {
    await setVehicleActive(parsed.data.id, true);
    revalidateVehiclePaths();
    revalidatePath(`/vehicles/${parsed.data.id}`);
    return okEmpty();
  } catch (error) {
    return fail(pgErrorMessage(error));
  }
}
