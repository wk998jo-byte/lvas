"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, UsersRound } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { PAGE_SIZES } from "@/components/dashboard/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { Employee, UserRole } from "@/types/database";

export type EmployeeFilter = "all" | UserRole;

type EmployeesBrowserProps = {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  role: EmployeeFilter;
  counts: Record<EmployeeFilter, number>;
};

const FILTERS: { key: EmployeeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "manager_requester", label: "Managers" },
  { key: "supervisor_requester", label: "Supervisors" },
  { key: "other_employee", label: "Other employees" },
];

function roleTone(role: UserRole) {
  switch (role) {
    case "manager_requester":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "supervisor_requester":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function EmployeesBrowser({
  employees,
  total,
  page,
  pageSize,
  query,
  role,
  counts,
}: EmployeesBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [draftQuery, setDraftQuery] = useState(query);

  useEffect(() => {
    setDraftQuery(query);
  }, [query]);

  function pushParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Debounce typing so each keystroke does not hit the database.
  useEffect(() => {
    if (draftQuery === query) return;
    const timer = setTimeout(() => {
      pushParams({ q: draftQuery || null, page: null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + employees.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search badge, name, ID, mobile, department, position…"
              className="h-10 rounded-xl border-slate-200 pl-10"
            />
            {pending ? (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : null}
          </div>
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700 tabular-nums">
              {total.toLocaleString()}
            </span>{" "}
            matching employee{total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = role === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  pushParams({
                    role: item.key === "all" ? null : item.key,
                    page: null,
                  })
                }
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-[#e30613] bg-[#e30613] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {counts[item.key].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={UsersRound}
            title={query ? "No matching employees" : "No employees yet"}
            description={
              query
                ? "Try another badge, name, department, or position."
                : "Run the employee import script to populate the directory."
            }
          />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Badge</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Mobile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-semibold tabular-nums text-slate-900">
                    {employee.badge}
                  </TableCell>
                  <TableCell className="max-w-72 truncate">
                    {employee.full_name}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {employee.department ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {employee.position ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("rounded-full", roleTone(employee.role))}
                    >
                      {roleLabel(employee.role)}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-500">
                    {employee.mobile ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{from}</span>
              –<span className="font-medium text-slate-700">{to}</span> of{" "}
              <span className="font-medium text-slate-700">
                {total.toLocaleString()}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) =>
                    pushParams({ size: event.target.value, page: null })
                  }
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus-visible:border-[#e30613]/40"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1 || pending}
                  onClick={() => pushParams({ page: String(page - 1) })}
                >
                  Previous
                </Button>
                <span className="px-2 text-sm tabular-nums text-slate-600">
                  {page} / {pageCount}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= pageCount || pending}
                  onClick={() => pushParams({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
