import { UsersRound } from "lucide-react";

import { requireRole } from "@/lib/auth/guards";
import { countEmployees, listEmployeesPage } from "@/lib/db/queries";
import {
  EmployeesBrowser,
  type EmployeeFilter,
} from "@/components/employees/employees-browser";
import type { UserRole } from "@/types/database";

const PAGE_SIZES = [25, 50, 100];
const ROLE_FILTERS: UserRole[] = [
  "manager_requester",
  "supervisor_requester",
  "other_employee",
];

function sanitizeQuery(value: string): string {
  return value.replace(/[,()*]/g, " ").trim().slice(0, 80);
}

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireRole("admin");

  const params = await searchParams;
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const query = sanitizeQuery(single("q") ?? "");
  const roleParam = single("role");
  const role: EmployeeFilter = ROLE_FILTERS.includes(roleParam as UserRole)
    ? (roleParam as UserRole)
    : "all";

  const sizeParam = Number(single("size"));
  const pageSize = PAGE_SIZES.includes(sizeParam) ? sizeParam : PAGE_SIZES[0]!;
  const requestedPage = Math.max(1, Number(single("page")) || 1);

  let allCount = 0;
  let managerCount = 0;
  let supervisorCount = 0;
  let otherCount = 0;
  let data: Awaited<ReturnType<typeof listEmployeesPage>> = [];
  let total = 0;
  let page = 1;
  let errorMessage: string | null = null;

  try {
    [allCount, managerCount, supervisorCount, otherCount] = await Promise.all([
      countEmployees({ query, role: "all" }),
      countEmployees({ query, role: "manager_requester" }),
      countEmployees({ query, role: "supervisor_requester" }),
      countEmployees({ query, role: "other_employee" }),
    ]);

    total =
      role === "all"
        ? allCount
        : role === "manager_requester"
          ? managerCount
          : role === "supervisor_requester"
            ? supervisorCount
            : otherCount;

    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    page = Math.min(requestedPage, pageCount);
    const start = (page - 1) * pageSize;

    data = await listEmployeesPage({
      query,
      role,
      offset: start,
      limit: pageSize,
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown error";
  }

  if (errorMessage) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-destructive" role="alert">
          Failed to load employees: {errorMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-rise">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/45 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 right-8 size-40 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#e30613] uppercase">
              <UsersRound className="size-3.5" />
              HR directory
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Employees
            </h1>
            <p className="max-w-xl text-sm text-slate-500 md:text-base">
              Imported from the HR master sheet. These records are a reference
              directory — they are not login accounts.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                Total
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {(allCount).toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-indigo-500/80 uppercase">
                Managers
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-indigo-700">
                {managerCount}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-sky-500/80 uppercase">
                Supervisors
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-700">
                {supervisorCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      <EmployeesBrowser
        employees={data}
        total={total}
        page={page}
        pageSize={pageSize}
        query={query}
        role={role}
        counts={{
          all: allCount,
          manager_requester: managerCount,
          supervisor_requester: supervisorCount,
          other_employee: otherCount,
          admin: 0,
        }}
      />
    </div>
  );
}
