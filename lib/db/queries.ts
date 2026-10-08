import { execute, getPool, query, queryOne } from "@/lib/db/pool";
import type { VisibleAuthorizationConflict } from "@/lib/authorizations/overlap";
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
  "id" | "door_number" | "plate_number" | "make" | "model" | "year" | "color"
>;

export type RequesterProfileRef = Pick<
  Profile,
  "full_name" | "email" | "department"
> | null;

export type RequesterEmployeeRef = Pick<
  Employee,
  "full_name" | "badge" | "department" | "mobile"
> | null;

export type ApprovedOverlapRow = {
  id: string;
  authorized_to: string;
  start_date: string;
  end_date: string;
};

export type AuthorizationListRow = Authorization & {
  vehicles: Pick<Vehicle, "door_number" | "plate_number" | "make" | "model"> | null;
  requester: RequesterProfileRef;
  employees: RequesterEmployeeRef;
  activeConflict?: VisibleAuthorizationConflict | null;
};

export type AuthorizationDetailRow = Authorization & {
  vehicles: Pick<
    Vehicle,
    "id" | "door_number" | "plate_number" | "make" | "model" | "year" | "color"
  > | null;
  requester: RequesterProfileRef;
  employees: RequesterEmployeeRef;
  approver: Pick<Profile, "full_name" | "email" | "department"> | null;
  first_approver: Pick<Profile, "full_name" | "email"> | null;
};

const AUTHORIZATION_LIST_SELECT = `
  a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
  a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
  a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
  a.purpose, a.rejection_reason, a.location, a.justification, a.approval_stage,
  a.first_approver_id, a.first_approved_at, a.approved_at, a.rejected_at,
  a.created_at, a.updated_at,
  case when v.id is null then null else jsonb_build_object(
    'door_number', v.door_number, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model
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

// Undefined is admin/global access; an empty array must never widen access.
function authorizationLocationClause(
  locations: readonly string[] | undefined,
  params: unknown[],
  alias = "a",
): string {
  if (locations === undefined) return "";
  params.push(locations);
  return ` and ${alias ? `${alias}.` : ""}location = any($${params.length}::text[])`;
}

export async function listActiveVehicles(): Promise<VehicleOption[]> {
  return query<VehicleOption>(
    `
      select id, door_number, plate_number, make, model, year, color
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
  door_number: string | null;
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
      insert into vehicles (plate_number, make, model, year, color, notes, created_by, door_number, is_active)
      values ($1, $2, $3, $4, $5, $6, $7, $8, true)
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
      input.door_number,
    ],
  );
  if (!row) throw new Error("Failed to create vehicle");
  return row;
}

export async function updateVehicleRow(
  id: string,
  fields: {
    door_number: string | null;
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
      set plate_number = $2, make = $3, model = $4, year = $5, color = $6, notes = $7, door_number = $8
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
      fields.door_number,
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

export async function getEmployeeByBadge(
  badge: string,
): Promise<(PublicEmployee & { national_id: string | null }) | null> {
  return queryOne<PublicEmployee & { national_id: string | null }>(
    `
      select id, badge, full_name, department, position, role, national_id
      from employees
      where badge = $1
      limit 1
    `,
    [badge],
  );
}

export type BadgeAuthorizationRow = {
  public_token: string;
  id: string;
  status: AuthorizationStatus;
  start_date: string;
  end_date: string;
  duration_label: string;
  purpose: string | null;
  rejection_reason: string | null;
  location: string | null;
  approval_stage: number;
  created_at: string;
  door_number: string | null;
  plate_number: string | null;
  make: string | null;
  model: string | null;
};

export async function listAuthorizationsByEmployeeId(
  employeeId: string,
): Promise<BadgeAuthorizationRow[]> {
  return query<BadgeAuthorizationRow>(
    `
      select
        a.public_token,
        a.id,
        a.status,
        a.start_date::text as start_date,
        a.end_date::text as end_date,
        a.duration_label,
        a.purpose,
        a.rejection_reason,
        a.location,
        a.approval_stage,
        a.created_at,
        v.door_number,
        v.plate_number,
        v.make,
        v.model
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.employee_id = $1
      order by a.created_at desc
      limit 50
    `,
    [employeeId],
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

let passwordResetTableReady: Promise<void> | null = null;

function ensurePasswordResetTable(): Promise<void> {
  passwordResetTableReady ??= query(`
    create table if not exists password_reset_tokens (
      id uuid primary key default gen_random_uuid(),
      profile_id uuid not null references profiles (id) on delete cascade,
      token_hash text not null,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default timezone('utc', now()),
      constraint password_reset_tokens_token_hash_unique unique (token_hash)
    )
  `).then(() => undefined);
  return passwordResetTableReady;
}

export async function replacePasswordResetToken(input: {
  profileId: string;
  tokenHash: string;
  expiresAt: string;
}) {
  await ensurePasswordResetTable();
  await query(
    `delete from password_reset_tokens where profile_id = $1 and used_at is null`,
    [input.profileId],
  );
  await query(
    `
      insert into password_reset_tokens (profile_id, token_hash, expires_at)
      values ($1, $2, $3)
    `,
    [input.profileId, input.tokenHash, input.expiresAt],
  );
}

export async function resetPasswordWithTokenHash(input: {
  tokenHash: string;
  passwordHash: string;
}): Promise<boolean> {
  await ensurePasswordResetTable();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const found = await client.query<{ profile_id: string }>(
      `
        select profile_id
        from password_reset_tokens
        where token_hash = $1
          and used_at is null
          and expires_at > timezone('utc', now())
        for update
      `,
      [input.tokenHash],
    );
    const profileId = found.rows[0]?.profile_id;
    if (!profileId) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `update profiles set password_hash = $2 where id = $1`,
      [profileId, input.passwordHash],
    );
    await client.query(
      `
        update password_reset_tokens
        set used_at = timezone('utc', now())
        where token_hash = $1
      `,
      [input.tokenHash],
    );
    await client.query(`delete from sessions where profile_id = $1`, [profileId]);
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteOtherSessions(profileId: string, currentTokenHash: string) {
  await query(
    `delete from sessions where profile_id = $1 and token_hash <> $2`,
    [profileId, currentTokenHash],
  );
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

export async function findApprovedOverlappingAuthorization(input: {
  vehicleId: string;
  startDate: string;
  endDate: string;
  excludeId?: string;
  locations?: readonly string[];
}): Promise<ApprovedOverlapRow | null> {
  const params: unknown[] = [
    input.vehicleId,
    input.startDate,
    input.endDate,
  ];
  let excludeSql = "";
  if (input.excludeId) {
    params.push(input.excludeId);
    excludeSql = `and a.id <> $${params.length}`;
  }
  const locationSql = authorizationLocationClause(input.locations, params);

  return queryOne(
    `
      select
        a.id,
        coalesce(nullif(e.full_name, ''), 'an employee') as authorized_to,
        a.start_date::text as start_date,
        a.end_date::text as end_date
      from authorizations a
      left join employees e on e.id = a.employee_id
      where a.vehicle_id = $1
        and a.status = 'approved'
        and a.start_date <= $3
        and a.end_date >= $2
        ${excludeSql}
        ${locationSql}
      order by a.end_date desc
      limit 1
    `,
    params,
  );
}

export async function listApprovedOverlapsForPending(
  pendingIds: string[],
  locations?: readonly string[],
): Promise<Map<string, VisibleAuthorizationConflict>> {
  const conflicts = new Map<string, VisibleAuthorizationConflict>();
  if (pendingIds.length === 0) return conflicts;

  const rows = await query<ApprovedOverlapRow & { pending_id: string; location: string | null }>(
    `
      select distinct on (p.id)
        p.id as pending_id,
        a.location,
        a.id,
        coalesce(nullif(e.full_name, ''), 'an employee') as authorized_to,
        a.start_date::text as start_date,
        a.end_date::text as end_date
      from authorizations p
      join authorizations a
        on a.vehicle_id = p.vehicle_id
       and a.status = 'approved'
       and a.id is distinct from p.id
       and a.start_date <= p.end_date
       and a.end_date >= p.start_date
      left join employees e on e.id = a.employee_id
      where p.id = any($1::uuid[])
      order by p.id, a.end_date desc
    `,
    [pendingIds],
  );

  for (const row of rows) {
    if (locations !== undefined && (row.location === null || !locations.includes(row.location))) {
      // Preserve the vehicle-unavailable signal, but never send another
      // location's request ID, employee name or dates to a logistics client.
      conflicts.set(row.pending_id, { restricted: true });
      continue;
    }
    conflicts.set(row.pending_id, {
      id: row.id,
      authorized_to: row.authorized_to,
      start_date: row.start_date,
      end_date: row.end_date,
    });
  }
  return conflicts;
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
  location: string;
  justification: string;
}): Promise<{ id: string; public_token: string }> {
  const row = await queryOne<{ id: string; public_token: string }>(
    `
      insert into authorizations (
        vehicle_id, employee_id, requester_id, approver_id, status,
        start_date, end_date, duration_label, usage_after, purpose, contact_mobile,
        location, justification, approval_stage
      )
      values ($1, $2, null, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, 1)
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
      input.location,
      input.justification,
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
             location, justification, approval_stage, first_approver_id, first_approved_at,
             approved_at, rejected_at, created_at, updated_at
      from authorizations
      where id = $1
    `,
    [id],
  );
}

export async function getAuthorizationDetail(
  id: string,
  locations?: readonly string[],
): Promise<AuthorizationDetailRow | null> {
  const params: unknown[] = [id];
  const locationSql = authorizationLocationClause(locations, params);
  return queryOne<AuthorizationDetailRow>(
    `
      select
        a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
        a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
        a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
        a.purpose, a.rejection_reason, a.location, a.justification, a.approval_stage,
        a.first_approver_id, a.first_approved_at, a.approved_at, a.rejected_at,
        a.created_at, a.updated_at,
        case when v.id is null then null else jsonb_build_object(
          'id', v.id, 'door_number', v.door_number, 'plate_number', v.plate_number, 'make', v.make,
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
        ) end as approver,
        case when fp.id is null then null else jsonb_build_object(
          'full_name', fp.full_name, 'email', fp.email
        ) end as first_approver
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      left join profiles ap on ap.id = a.approver_id
      left join profiles fp on fp.id = a.first_approver_id
      where a.id = $1
        ${locationSql}
    `,
    params,
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
    location: string | null;
    justification: string | null;
    approval_stage: number;
    created_at: string;
    vehicles: Pick<Vehicle, "door_number" | "plate_number" | "make" | "model"> | null;
    employees: Pick<Employee, "full_name" | "badge"> | null;
  }>(
    `
      select
        a.id, a.status, a.start_date::text as start_date, a.end_date::text as end_date,
        a.duration_label, a.usage_after::text as usage_after, a.purpose,
        a.rejection_reason, a.location, a.justification, a.approval_stage, a.created_at,
        case when v.id is null then null else jsonb_build_object(
          'door_number', v.door_number, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model
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
  filter?: { stage: number; locations?: string[] },
): Promise<AuthorizationListRow[]> {
  const params: unknown[] = [limit];
  const clauses = ["a.status = 'pending'"];
  if (filter) {
    params.push(filter.stage);
    clauses.push(`a.approval_stage = $${params.length}`);
    if (filter.locations) {
      params.push(filter.locations);
      clauses.push(`a.location = any($${params.length}::text[])`);
    }
  }
  const rows = await query<AuthorizationListRow>(
    `
      select ${AUTHORIZATION_LIST_SELECT}
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      where ${clauses.join(" and ")}
      order by a.created_at asc
      limit $1
    `,
    params,
  );
  const conflicts = await listApprovedOverlapsForPending(rows.map((row) => row.id), filter?.locations);
  return rows.map((row) => ({
    ...row,
    activeConflict: conflicts.get(row.id) ?? null,
  }));
}

/** Logistics-only read view; callers must supply their current assigned locations. */
export async function listLogisticsWaitingForFinalApproval(
  locations: readonly string[],
  limit = 200,
): Promise<(AuthorizationListRow & { first_approver: Pick<Profile, "full_name"> | null })[]> {
  return query(
    `
      select ${AUTHORIZATION_LIST_SELECT},
        case when fp.id is null then null else jsonb_build_object(
          'full_name', fp.full_name
        ) end as first_approver
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      left join profiles fp on fp.id = a.first_approver_id
      where a.status = 'pending' and a.approval_stage = $2
        and a.location = any($3::text[])
      order by a.first_approved_at desc nulls last, a.created_at desc
      limit $1
    `,
    [limit, 2, locations],
  );
}

export async function listHistoryAuthorizations(
  limit = 300,
  locations?: readonly string[],
): Promise<AuthorizationListRow[]> {
  const params: unknown[] = [limit];
  const locationSql = authorizationLocationClause(locations, params);
  return query<AuthorizationListRow>(
    `
      select ${AUTHORIZATION_LIST_SELECT}
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      left join profiles p on p.id = a.requester_id
      left join employees e on e.id = a.employee_id
      where a.status in ('approved', 'rejected', 'expired', 'cancelled')
        ${locationSql}
      order by a.updated_at desc
      limit $1
    `,
    params,
  );
}

export async function listExpiringAuthorizations(input: {
  today: string;
  in7Days: string;
  limit?: number;
  locations?: readonly string[];
}) {
  const params: unknown[] = [input.today, input.in7Days, input.limit ?? 6];
  const locationSql = authorizationLocationClause(input.locations, params);
  return query<{
    id: string;
    end_date: string;
    vehicles: Pick<Vehicle, "door_number" | "plate_number" | "make" | "model"> | null;
  }>(
    `
      select
        a.id, a.end_date::text as end_date,
        case when v.id is null then null else jsonb_build_object(
          'door_number', v.door_number, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model
        ) end as vehicles
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.status = 'approved'
        and a.end_date >= $1::date
        and a.end_date <= $2::date
        ${locationSql}
      order by a.end_date asc
      limit $3
    `,
    params,
  );
}

export async function listInsightAuthorizations(sinceIso: string, limit = 500, locations?: readonly string[]) {
  const params: unknown[] = [sinceIso, limit];
  const locationSql = authorizationLocationClause(locations, params);
  return query<{
    status: AuthorizationStatus;
    created_at: string;
    approved_at: string | null;
    rejected_at: string | null;
    vehicles: { door_number: string | null; plate_number: string } | null;
  }>(
    `
      select
        a.status, a.created_at, a.approved_at, a.rejected_at,
        case when v.id is null then null else jsonb_build_object(
          'door_number', v.door_number, 'plate_number', v.plate_number
        ) end as vehicles
      from authorizations a
      left join vehicles v on v.id = a.vehicle_id
      where a.created_at >= $1::timestamptz
        ${locationSql}
      order by a.created_at desc
      limit $2
    `,
    params,
  );
}

export async function countAuthorizationsByStatus(
  status: AuthorizationStatus,
  locations?: readonly string[],
): Promise<number> {
  const params: unknown[] = [status];
  const locationSql = authorizationLocationClause(locations, params, "");
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from authorizations where status = $1${locationSql}`,
    params,
  );
  return Number(row?.count ?? 0);
}

export async function countPendingAuthorizations(locations?: readonly string[]): Promise<number> {
  return countAuthorizationsByStatus("pending", locations);
}

export async function countPendingForReview(input: {
  stage: number;
  locations?: string[];
}): Promise<number> {
  const params: unknown[] = [input.stage];
  const clauses = ["status = 'pending'", "approval_stage = $1"];
  if (input.locations) {
    params.push(input.locations);
    clauses.push(`location = any($${params.length}::text[])`);
  }
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from authorizations where ${clauses.join(" and ")}`,
    params,
  );
  return Number(row?.count ?? 0);
}

export async function listLocationsForApprover(
  profileId: string,
): Promise<string[]> {
  const rows = await query<{ location: string }>(
    `
      select location
      from logistics_approver_locations
      where profile_id = $1
      order by location asc
    `,
    [profileId],
  );
  return rows.map((row) => row.location);
}

export async function listLogisticsApproverIdsForLocation(
  location: string,
): Promise<string[]> {
  const rows = await query<{ profile_id: string }>(
    `
      select p.id as profile_id
      from logistics_approver_locations l
      join profiles p on p.id = l.profile_id
      where l.location = $1
        and p.role = 'logistics_approver'
        and p.is_active = true
    `,
    [location],
  );
  return rows.map((row) => row.profile_id);
}

export async function advanceToFinalApproval(input: {
  id: string;
  approverId: string;
  approvedAt: string;
}): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      update authorizations
      set approval_stage = 2,
          first_approver_id = $2,
          first_approved_at = $3
      where id = $1
        and status = 'pending'
        and approval_stage = 1
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        location, justification, approval_stage, first_approver_id, first_approved_at,
        approved_at, rejected_at, created_at, updated_at
    `,
    [input.id, input.approverId, input.approvedAt],
  );
}

export async function countApprovedActive(today: string, locations?: readonly string[]): Promise<number> {
  const params: unknown[] = [today];
  const locationSql = authorizationLocationClause(locations, params, "");
  const row = await queryOne<{ count: string }>(
    `
      select count(*)::text as count
      from authorizations
      where status = 'approved' and end_date >= $1::date
        ${locationSql}
    `,
    params,
  );
  return Number(row?.count ?? 0);
}

export async function countExpiringWithin(
  today: string,
  in7Days: string,
  locations?: readonly string[],
): Promise<number> {
  const params: unknown[] = [today, in7Days];
  const locationSql = authorizationLocationClause(locations, params, "");
  const row = await queryOne<{ count: string }>(
    `
      select count(*)::text as count
      from authorizations
      where status = 'approved'
        and end_date >= $1::date
        and end_date <= $2::date
        ${locationSql}
    `,
    params,
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
      where id = $1 and status = 'pending' and approval_stage = 2
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        location, justification, approval_stage, first_approver_id, first_approved_at,
        approved_at, rejected_at, created_at, updated_at
    `,
    [input.id, input.approverId, input.approvedAt],
  );
}

export async function cancelApprovedAuthorization(
  id: string,
): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      update authorizations
      set status = 'cancelled'
      where id = $1 and status = 'approved'
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        location, justification, approval_stage, first_approver_id, first_approved_at,
        approved_at, rejected_at, created_at, updated_at
    `,
    [id],
  );
}

export async function rejectPendingAuthorization(input: {
  id: string;
  approverId: string;
  rejectedAt: string;
  rejectionReason: string;
  approvalStage: number;
}): Promise<Authorization | null> {
  return queryOne<Authorization>(
    `
      update authorizations
      set status = 'rejected',
          rejected_at = $3,
          approved_at = null,
          rejection_reason = $4,
          approver_id = $2
      where id = $1 and status = 'pending' and approval_stage = $5
      returning
        id, vehicle_id, requester_id, employee_id, public_token, contact_mobile,
        approver_id, status, start_date::text as start_date, end_date::text as end_date,
        duration_label, usage_after::text as usage_after, purpose, rejection_reason,
        location, justification, approval_stage, first_approver_id, first_approved_at,
        approved_at, rejected_at, created_at, updated_at
    `,
    [
      input.id,
      input.approverId,
      input.rejectedAt,
      input.rejectionReason,
      input.approvalStage,
    ],
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
      vehicles: Pick<Vehicle, "door_number" | "plate_number" | "make" | "model"> | null;
    }
  >
> {
  return query(
    `
      select
        a.id, a.vehicle_id, a.requester_id, a.employee_id, a.public_token,
        a.contact_mobile, a.approver_id, a.status, a.start_date::text as start_date,
        a.end_date::text as end_date, a.duration_label, a.usage_after::text as usage_after,
        a.purpose, a.rejection_reason, a.location, a.justification, a.approval_stage,
        a.first_approver_id, a.first_approved_at, a.approved_at, a.rejected_at,
        a.created_at, a.updated_at,
        case when v.id is null then null else jsonb_build_object(
          'door_number', v.door_number, 'plate_number', v.plate_number, 'make', v.make, 'model', v.model
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
