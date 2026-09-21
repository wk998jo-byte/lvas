import { z } from "zod";

export const emailSchema = z.string().email();

const plateSchema = z
  .string()
  .trim()
  .min(1, "Plate number is required")
  .max(32, "Plate number is too long");

const yearSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === "") return null;
    const num = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(num) || num < 1980 || num > 2100) {
      ctx.addIssue({
        code: "custom",
        message: "Year must be between 1980 and 2100",
      });
      return z.NEVER;
    }
    return num;
  });

export const vehicleFormSchema = z.object({
  plate_number: plateSchema,
  make: z.string().trim().min(1, "Make is required").max(80),
  model: z.string().trim().min(1, "Model is required").max(80),
  year: yearSchema,
  color: z
    .string()
    .trim()
    .max(40)
    .transform((value) => (value.length === 0 ? null : value)),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value.length === 0 ? null : value)),
});

export const updateVehicleSchema = vehicleFormSchema.extend({
  id: z.string().uuid("Invalid vehicle id"),
});

export const vehicleIdSchema = z.object({
  id: z.string().uuid("Invalid vehicle id"),
});

const authorizationFieldsSchema = z.object({
  vehicle_id: z.string().uuid("Select a vehicle"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date is required"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date is required"),
  duration_label: z.string().trim().min(1, "Duration is required").max(80),
  usage_after: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Usage time must be HH:MM")
    .default("19:00"),
  purpose: z
    .string()
    .trim()
    .max(500)
    .transform((value) => (value.length === 0 ? null : value)),
});

const endsAfterStart = {
  check: (data: { start_date: string; end_date: string }) =>
    data.end_date >= data.start_date,
  message: "End date must be on or after start date",
  path: ["end_date"] as const,
};

export const authorizationFormSchema = authorizationFieldsSchema.refine(
  endsAfterStart.check,
  { message: endsAfterStart.message, path: [...endsAfterStart.path] },
);

export const employeeLookupSchema = z.object({
  query: z.string().trim().min(3, "Enter at least 3 characters").max(80),
});

export const employeeVerifySchema = z.object({
  employee_id: z.string().uuid("Select your name from the list"),
  id_last4: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the last 4 digits of your ID"),
});

export const publicRequestSchema = authorizationFieldsSchema
  .extend({
    employee_id: z.string().uuid("Select your name from the list"),
    id_last4: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "Enter the last 4 digits of your ID"),
    contact_mobile: z
      .string()
      .trim()
      .regex(/^\d{9,15}$/, "Enter a valid mobile number"),
  })
  .refine(endsAfterStart.check, {
    message: endsAfterStart.message,
    path: [...endsAfterStart.path],
  });

export const publicTokenSchema = z.object({
  token: z.string().uuid("Invalid tracking link"),
});

export const authorizationIdSchema = z.object({
  id: z.string().uuid("Invalid authorization id"),
});

export const rejectAuthorizationSchema = authorizationIdSchema.extend({
  rejection_reason: z
    .string()
    .trim()
    .min(1, "Rejection reason is required")
    .max(500, "Rejection reason is too long"),
});

export const userRoleSchema = z.enum([
  "manager_requester",
  "supervisor_requester",
  "other_employee",
  "admin",
]);

export const updateUserRoleSchema = z.object({
  id: z.string().uuid("Invalid user id"),
  role: userRoleSchema,
});

export const updateUserActiveSchema = z.object({
  id: z.string().uuid("Invalid user id"),
  is_active: z.boolean(),
});

export const updateUserProfileSchema = z.object({
  id: z.string().uuid("Invalid user id"),
  full_name: z.string().trim().max(120),
  department: z
    .string()
    .trim()
    .max(120)
    .transform((value) => (value.length === 0 ? null : value)),
});

export type VehicleFormValues = z.infer<typeof vehicleFormSchema>;
export type AuthorizationFormValues = z.infer<typeof authorizationFormSchema>;
export type UserRoleValue = z.infer<typeof userRoleSchema>;
