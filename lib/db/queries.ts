import { execute, query, queryOne } from "@/lib/db/pool";
import type {
  Authorization,
  AuthorizationStatus,
  Employee,
  NotificationType,
  Profile,
  UserRole,
  Vehicle,
} from "@/types/database";

export type PublicEmployee = {
  id: string;
  badge: string;
  full_name: string;
  department: string | null;
  position: string | null;
  role: UserRole;
};

export type VehicleOption = Pick<
  Vehicle,
  "id" | "plate_number" | "make" | "model" | "year" | "color"
>;

export type RequesterProfileRef = Pick<
  Profile,
  "full_name" | "email" | "department"
> | null;

export type RequesterEmployeeRef = Pick<
  Employee,
  "full_name" | "badge" | "department" | "mobile"
> | null;

export type AuthorizationListRow = Authorization & {
  vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
  requester: RequesterProfileRef;
  employees: RequesterEmployeeRef;
};

export type AuthorizationDetailRow = Authorization & {
  vehicles: Pick<
    Vehicle,
    "id" | "plate_number" | "make" | "model" | "year" | "color"
  > | null;
  requester: RequesterProfileRef;
  employees: RequesterEmployeeRef;
  approver: Pick<Profile, "full_name" | "email" | "department"> | null;
};

const AUTHORIZATION_LIST_SELECT = `
  a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
  a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
  a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
  a.purpose, a.rejection_reason, a.approved_at, a.rejected_at, a.created_at, a.updated_at,
  case when v.id is null then null else jsonb_build_object(
    'plate_number', v.plate_number, 'make', v.make, 'model', v.model
  ) end as vehicles,
  case when p.id is null then null else jsonb_build_object(
    'full_name', p.full_name, 'email', p.email, 'department', p.department
  ) end as requester,
  case when e.id is null then null else jsonb_build_object(
    'full_name', e.full_name, 'badge', e.badge, 'department', e.department, 'mobile', e.mobile
  ) end as employees
`;

function likeContains(term: string): string {
  return `%${term.replace(/[%_\\]/g, "")}%`;
}

export async function listActiveVehicles(): Promise<VehicleOption[]> {
  return query<VehicleOption>(
    `
      select id, plate_number, make, model, year, color
      from vehicles
      where is_active = true
      order by plate_number asc
    `,
  );
}

export async function listVehicles(activeOnly: boolean): Promise<Vehicle[]> {
  if (activeOnly) {
    return query<Vehicle>(
      `select * from vehicles where is_active = true order by plate_number asc`,
    );
  }
  return query<Vehicle>(`select * from vehicles order by plate_number asc`);
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  return queryOne<Vehicle>(`select * from vehicles where id = $1`, [id]);
}

export async function insertVehicle(input: {
  plate_number: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  notes: string | null;
  created_by: string;
}): Promise<Vehicle> {
  const row = await queryOne<Vehicle>(
    `
      insert into vehicles (plate_number, make, model, year, color, notes, created_by, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, true)
      returning *
    `,
    [
      input.plate_number,
      input.make,
      input.model,
      input.year,
      input.color,
      input.notes,
      input.created_by,
    ],
  );
  if (!row) throw new Error("Failed to create vehicle");
  return row;
}

export async function updateVehicleRow(
  id: string,
  fields: {
    plate_number: string;
    make: string;
    model: string;
    year: number | null;
    color: string | null;
    notes: string | null;
  },
): Promise<Vehicle | null> {
  return queryOne<Vehicle>(
    `
      update vehicles
      set plate_number = $2, make = $3, model = $4, year = $5, color = $6, notes = $7
      where id = $1
      returning *
    `,
    [
      id,
      fields.plate_number,
      fields.make,
      fields.model,
      fields.year,
      fields.color,
      fields.notes,
    ],
  );
}

export async function setVehicleActive(id: string, isActive: boolean) {
  await query(`update vehicles set is_active = $2 where id = $1`, [id, isActive]);
}

export async function lookupPublicEmployees(
  term: string,
  limit = 8,
): Promise<PublicEmployee[]> {
  const pattern = likeContains(term);
  return query<PublicEmployee>(
    `
      select id, badge, full_name, department, position, role
      from employees
      where badge ilike $1
         or full_name ilike $1
      order by full_name asc
      limit $2
    `,
    [pattern, limit],
  );
}

export async function getEmployeeForVerify(
  id: string,
): Promise<(PublicEmployee & { national_id: string | null }) | null> {
  return queryOne<PublicEmployee & { national_id: string | null }>(
    `
      select id, badge, full_name, department, position, role, national_id
      from employees
      where id = $1
    `,
    [id],
  );
}

export async function listEmployeesPage(input: {
  query: string;
  role: UserRole | "all";
  offset: number;
  limit: number;
}): Promise<Employee[]> {
  const params: unknown[] = [];
  const where: string[] = [];

  if (input.query) {
    params.push(likeContains(input.query));
    where.push(
      `(badge ilike $${params.length}  or full_name ilike $${params.length}  or coalesce(national_id,'') ilike $${params.length}  or coalesce(mobile,'') ilike $${params.length}  or coalesce(department,'') ilike $${params.length}  or coalesce(position,'') ilike $${params.length} )`,
    );
  }
  if (input.role !== "all") {
    params.push(input.role);
    where.push(`role = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(input.limit, input.offset);

  return query<Employee>(
    `
      select *
      from employees
      ${whereSql}
      order by badge asc
      limit $${params.length - 1} offset $${params.length}
    `,
    params,
  );
}

export async function countEmployees(input: {
  query: string;
  role: UserRole | "all";
}): Promise<number> {
  const params: unknown[] = [];
  const where: string[] = [];

  if (input.query) {
    params.push(likeContains(input.query));
    where.push(
      `(badge ilike $${params.length}  or full_name ilike $${params.length}  or coalesce(national_id,'') ilike $${params.length}  or coalesce(mobile,'') ilike $${params.length}  or coalesce(department,'') ilike $${params.length}  or coalesce(position,'') ilike $${params.length} )`,
    );
  }
  if (input.role !== "all") {
    params.push(input.role);
    where.push(`role = $${params.length}`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from employees ${whereSql}`,
    params,
  );
  return Number(row?.count ?? 0);
}

export async function getOldestActiveAdminId(): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `
      select id
      from profiles
      where role = 'admin' and is_active = true
      order by created_at asc
      limit 1
    `,
  );
  return row?.id ?? null;
}

export async function getProfileByEmail(email: string): Promise<
  (Profile & { password_hash: string | null }) | null
> {
  return queryOne<Profile & { password_hash: string | null }>(
    `
      select id, full_name, email, role, department, is_active,
             password_hash, created_at, updated_at
      from profiles
      where lower(email) = lower($1)
    `,
    [email],
  );
}

export async function setProfilePasswordHash(id: string, passwordHash: string) {
  await query(`update profiles set password_hash = $2 where id = $1`, [
    id,
    passwordHash,
  ]);
}

export async function getLastLimitRequestAt(employeeId: string): Promise<string | null> {
  const row = await queryOne<{ created_at: string }>(
    `
      select created_at
      from authorizations
      where employee_id = $1
        and status in ('pending', 'approved')
      order by created_at desc
      limit 1
    `,
    [employeeId],
  );
  return row?.created_at ?? null;
}

export async function findOverlappingAuthorization(input: {
  vehicleId: string;
  startDate: string;
  endDate: string;
  excludeId?: string;
}): Promise<{
  id: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved";
} | null> {
  const params: unknown[] = [
    input.vehicleId,
    input.startDate,
    input.endDate,
  ];
  let excludeSql = "";
  if (input.excludeId) {
    params.push(input.excludeId);
    excludeSql = `and id <> $${params.length}`;
  }

  return queryOne(
    `
      select id, start_date::text as start_date, end_date::text as end_date, status
      from authorizations
      where vehicle_id = $1
        and status in ('pending', 'approved')
        and start_date <= $3
        and end_date >= $2
        ${excludeSql}
      limit 1
    `,
    params,
  );
}

export async function insertAuthorization(input: {
  vehicle_id: string;
  employee_id: string;
  approver_id: string;
  start_date: string;
  end_date: string;
  duration_label: string;
  usage_after: string;
  purpose: string | null;
  contact_mobile: string;
}): Promise<{ id: string; public_token: string }> {
  const row = await queryOne<{ id: string; public_token: string }>(
    `
      insert into authorizations (
        vehicle_id, employee_id, requester_id, approver_id, status,
        start_date, end_date, duration_label, usage_after, purpose, contact_mobile
      )
      values ($1, $2, null, $3, 'pending', $4, $5, $6, $7, $8, $9)
      returning id, public_token
    `,
    [
      input.vehicle_id,
      input.employee_id,
      input.approver_id,
      input.start_date,
      input.end_date,
      input.duration_label,
      input.usage_after,
      input.purpose,
      input.contact_mobile,
    ],
  );
  if (!row) throw new Error("Failed to create authorization");
  return row;
}

export async function insertNotification(input: {
  user_id: string;
  authorization_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read?: boolean;
  sent_at?: string | null;
  dedupe_key?: string | null;
}) {
  await query(
    `
      insert into notifications (
        user_id, authorization_id, type, title, body, is_read, sent_at, dedupe_key
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      input.user_id,
      input.authorization_id,
      input.type,
      input.title,
      input.body,
      input.is_read ?? false,
      input.sent_at ?? null,
      input.dedupe_key ?? null,
    ],
  );
}

export async function getAuthorizationById(id: string): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      select id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
             approver_id, status, start_date::text as start_date, end_date::text as end_date,
             duration_label, usage_after::text as usage_after, purpose, rejection_reason,
             approved_at, rejected_at, created_at, updated_at
      from authorizations
      where id = $1
    `,
    [id],
  );
}

export async function getAuthorizationDetail(
  id: string,
): Promise<AuthorizationDetailRow | null> {
  return queryOne<AuthorizationDetailRow>(
    `
      select
        a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
        a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
        a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
        a.purpose, a.rejection_reason, a.approved_at, a.rejected_at, a.created_at, a.updated_at,
        case when v.id is null then null else jsonb_build_object(
          'id', v.id, 'plate_number', v.plate_number, 'make', v.make,
          'model', v.model, 'year', v.year, 'color', v.color
        ) end as vehicles,
        case when p.id is null then null else jsonb_build_object(
          'full_name', p.full_name, 'email', p.email, 'department', p.department
        ) end as requester,
        case when e.id is null then null else jsonb_build_object(
          'full_name', e.full_name, 'badge', e.badge, 'department', e.department, 'mobile', e.mobile
        ) end as employees,
        case when ap.id is null then null else jsonb_build_object(
          'full_name', ap.full_name, 'email', ap.email, 'department', ap.department
        ) end as approver
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      left join profiles ap on ap.id = a.approver_id
      where a.id = $1
    `,
    [id],
  );
}

export async function getAuthorizationByPublicToken(token: string) {
  return queryOne<{
    id: string;
    status: AuthorizationStatus;
    start_date: string;
    end_date: string;
    duration_label: string;
    usage_after: string;
    purpose: string | null;
    rejection_reason: string | null;
    created_at: string;
    vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
    employees: Pick<Employee, "full_name" | "badge"> | null;
  }>(
    `
      select
        a.id, a.status, a.start_date::text as start_date, a.end_date::text as end_date,
        a.duration_label, a.usage_after::text as usage_after, a.purpose,
        a.rejection_reason, a.created_at,
        case when v.id is null then null else jsonb_build_object(
          'plate_number', v.plate_number, 'make', v.make, 'model', v.model
        ) end as vehicles,
        case when e.id is null then null else jsonb_build_object(
          'full_name', e.full_name, 'badge', e.badge
        ) end as employees
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join employees e on e.id = a.employee_id
      where a.public_token = $1
    `,
    [token],
  );
}

export async function listPendingAuthorizations(
  limit = 200,
): Promise<AuthorizationListRow[]> {
  return query<AuthorizationListRow>(
    `
      select ${AUTHORIZATION_LIST_SELECT}
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      where a.status = 'pending'
      order by a.created_at asc
      limit $1
    `,
    [limit],
  );
}

export async function listHistoryAuthorizations(
  limit = 300,
): Promise<AuthorizationListRow[]> {
  return query<AuthorizationListRow>(
    `
      select ${AUTHORIZATION_LIST_SELECT}
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      where a.status in ('approved', 'rejected', 'expired', 'cancelled')
      order by a.updated_at desc
      limit $1
    `,
    [limit],
  );
}

export async function listExpiringAuthorizations(input: {
  today: string;
  in7Days: string;
  limit?: number;
}) {
  return query<{
    id: string;
    end_date: string;
    vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
  }>(
    `
      select
        a.id, a.end_date::text as end_date,
        case when v.id is null then null else jsonb_build_object(
          'plate_number', v.plate_number, 'make', v.make, 'model', v.model
        ) end as vehicles
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.status = 'approved'
        and a.end_date >= $1::date
        and a.end_date <= $2::date
      order by a.end_date asc
      limit $3
    `,
    [input.today, input.in7Days, input.limit ?? 6],
  );
}

export async function listInsightAuthorizations(sinceIso: string, limit = 500) {
  return query<{
    status: AuthorizationStatus;
    created_at: string;
    approved_at: string | null;
    rejected_at: string | null;
    vehicles: { plate_number: string } | null;
  }>(
    `
      select
        a.status, a.created_at, a.approved_at, a.rejected_at,
        case when v.id is null then null else jsonb_build_object(
          'plate_number', v.plate_number
        ) end as vehicles
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.created_at >= $1::timestamptz
      order by a.created_at desc
      limit $2
    `,
    [sinceIso, limit],
  );
}

export async function countAuthorizationsByStatus(
  status: AuthorizationStatus,
): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from authorizations where status = $1`,
    [status],
  );
  return Number(row?.count ?? 0);
}

export async function countPendingAuthorizations(): Promise<number> {
  return countAuthorizationsByStatus("pending");
}

export async function countApprovedActive(today: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `
      select count(*)::text as count
      from authorizations
      where status = 'approved' and end_date >= $1::date
    `,
    [today],
  );
  return Number(row?.count ?? 0);
}

export async function countExpiringWithin(
  today: string,
  in7Days: string,
): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `
      select count(*)::text as count
      from authorizations
      where status = 'approved'
        and end_date >= $1::date
        and end_date <= $2::date
    `,
    [today, in7Days],
  );
  return Number(row?.count ?? 0);
}

export async function countActiveVehicles(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from vehicles where is_active = true`,
  );
  return Number(row?.count ?? 0);
}

export async function approvePendingAuthorization(input: {
  id: string;
  approverId: string;
  approvedAt: string;
}): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      update authorizations
      set status = 'approved',
          approved_at = $3,
          rejected_at = null,
          rejection_reason = null,
          approver_id = $2
      where id = $1 and status = 'pending'
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        approved_at, rejected_at, created_at, updated_at
    `,
    [input.id, input.approverId, input.approvedAt],
  );
}

export async function rejectPendingAuthorization(input: {
  id: string;
  approverId: string;
  rejectedAt: string;
  rejectionReason: string;
}): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      update authorizations
      set status = 'rejected',
          rejected_at = $3,
          approved_at = null,
          rejection_reason = $4,
          approver_id = $2
      where id = $1 and status = 'pending'
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        approved_at, rejected_at, created_at, updated_at
    `,
    [input.id, input.approverId, input.rejectedAt, input.rejectionReason],
  );
}

export async function markApprovedExpired(today: string): Promise<number> {
  return execute(
    `
      update authorizations
      set status = 'expired'
      where status = 'approved' and end_date < $1::date
    `,
    [today],
  );
}

export async function listApprovedEndingBetween(input: {
  today: string;
  maxEnd: string;
}): Promise<
  Array<
    Authorization & {
      vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
    }
  >
> {
  return query(
    `
      select
        a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
        a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
        a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
        a.purpose, a.rejection_reason, a.approved_at, a.rejected_at, a.created_at, a.updated_at,
        case when v.id is null then null else jsonb_build_object(
          'plate_number', v.plate_number, 'make', v.make, 'model', v.model
        ) end as vehicles
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.status = 'approved'
        and a.end_date >= $1::date
        and a.end_date <= $2::date
    `,
    [input.today, input.maxEnd],
  );
}
