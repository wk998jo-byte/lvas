"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarRange,
  Car,
  Check,
  ClipboardCheck,
  Clock3,
  Search,
  Timer,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  approveAuthorization,
  rejectAuthorization,
} from "@/actions/approvals";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import { AuthorizationStatusBadge } from "@/components/authorizations/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveRequester,
  type RequesterEmployeeRef,
  type RequesterProfileRef,
} from "@/lib/authorizations/requester";
import { cn } from "@/lib/utils";
import type {
  Authorization,
  AuthorizationStatus,
  Vehicle,
} from "@/types/database";

export type ApprovalListItem = Authorization & {
  vehicles: Pick<Vehicle, "plate_number" | "make" | "model"> | null;
  requester: RequesterProfileRef;
  employees: RequesterEmployeeRef;
};

type FilterKey =
  | "all"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "cancelled";

/** `queue` decides on pending requests; `history` reviews decided ones. */
type TableMode = "queue" | "history";

const MODE_FILTERS: Record<TableMode, { key: FilterKey; label: string }[]> = {
  queue: [],
  history: [
    { key: "all", label: "All" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "expired", label: "Expired" },
    { key: "cancelled", label: "Cancelled" },
  ],
};

type ApprovalsTableProps = {
  requests: ApprovalListItem[];
  mode?: TableMode;
};

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email || "RQ";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ApprovalsTable({
  requests,
  mode = "queue",
}: ApprovalsTableProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const filters = MODE_FILTERS[mode];

  const counts = useMemo(() => {
    const byStatus = (status: string) =>
      requests.filter((r) => r.status === status).length;
    return {
      all: requests.length,
      pending: byStatus("pending"),
      approved: byStatus("approved"),
      rejected: byStatus("rejected"),
      expired: byStatus("expired"),
      cancelled: byStatus("cancelled"),
    };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((request) => {
      if (filter !== "all" && request.status !== filter) return false;
      if (!q) return true;

      const person = resolveRequester({
        profile: request.requester,
        employee: request.employees,
        contactMobile: request.contact_mobile,
      });
      const requesterName = person.name.toLowerCase();
      const requesterEmail = (person.contact ?? "").toLowerCase();
      const department = (person.department ?? "").toLowerCase();
      const badge = (person.badge ?? "").toLowerCase();
      const plate = request.vehicles?.plate_number?.toLowerCase() ?? "";
      const vehicle =
        `${request.vehicles?.make ?? ""} ${request.vehicles?.model ?? ""}`.toLowerCase();
      const purpose = (request.purpose ?? "").toLowerCase();

      return (
        requesterName.includes(q) ||
        requesterEmail.includes(q) ||
        department.includes(q) ||
        badge.includes(q) ||
        plate.includes(q) ||
        vehicle.includes(q) ||
        purpose.includes(q)
      );
    });
  }, [requests, query, filter]);

  function onApprove(id: string) {
    startTransition(async () => {
      const result = await approveAuthorization({ id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Request approved");
    });
  }

  function onRejectConfirm() {
    if (!rejectId) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error("Rejection reason is required");
      return;
    }

    startTransition(async () => {
      const result = await rejectAuthorization({
        id: rejectId,
        rejection_reason: trimmed,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Request rejected");
      setRejectId(null);
      setReason("");
    });
  }

  return (
    <div className="space-y-5">
      <div className="glass-panel flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search requester, badge, plate, department…"
              className="h-11 rounded-xl border-slate-200/80 bg-white/90 pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {filtered.length}
              </span>
            </p>
            <ExportCsvButton
              filename={`lvas-${mode === "queue" ? "pending" : "history"}-${new Date().toISOString().slice(0, 10)}.csv`}
              rows={filtered.map((request) => {
                const person = resolveRequester({
                  profile: request.requester,
                  employee: request.employees,
                  contactMobile: request.contact_mobile,
                });
                return {
                id: request.id,
                status: request.status,
                requester_name: person.name,
                requester_badge: person.badge ?? "",
                requester_contact: person.contact ?? "",
                submitted_via: person.source === "public" ? "public form" : "account",
                department: person.department ?? "",
                plate_number: request.vehicles?.plate_number ?? "",
                vehicle: request.vehicles
                  ? `${request.vehicles.make} ${request.vehicles.model}`
                  : "",
                start_date: request.start_date,
                end_date: request.end_date,
                duration_label: request.duration_label,
                usage_after:
                  typeof request.usage_after === "string"
                    ? request.usage_after.slice(0, 5)
                    : request.usage_after,
                purpose: request.purpose ?? "",
                rejection_reason: request.rejection_reason ?? "",
                created_at: request.created_at,
                approved_at: request.approved_at ?? "",
                rejected_at: request.rejected_at ?? "",
                };
              })}
            />
          </div>
        </div>

        <div
          className={cn("flex flex-wrap gap-2", filters.length === 0 && "hidden")}
        >
          {filters.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "border-[#e30613]/25 bg-[#e30613] text-white shadow-[0_8px_20px_-10px_rgba(227,6,19,0.7)]"
                    : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white",
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
                  {counts[item.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title={
            mode === "queue"
              ? "No pending requests right now"
              : "Nothing in the history yet"
          }
          description={
            mode === "queue"
              ? "All caught up! New submissions land here for your decision."
              : "Approved, rejected, cancelled, and expired requests appear here."
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((request, index) => {
            const vehicle = request.vehicles;
            const requester = resolveRequester({
              profile: request.requester,
              employee: request.employees,
              contactMobile: request.contact_mobile,
            });
            const usage =
              typeof request.usage_after === "string"
                ? request.usage_after.slice(0, 5)
                : request.usage_after;
            const isPending =
              (request.status as AuthorizationStatus) === "pending";
            const plate = vehicle?.plate_number ?? "Vehicle";
            const model = vehicle
              ? `${vehicle.make} ${vehicle.model}`
              : "Details unavailable";

            return (
              <article
                key={request.id}
                className={cn(
                  "group glass-panel relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
                  "hover:-translate-y-0.5 hover:border-[#e30613]/20 hover:shadow-[0_18px_40px_-22px_rgba(227,6,19,0.25)]",
                  "animate-rise",
                  isPending && "border-[#e30613]/12",
                )}
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/35 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                />

                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white text-sm font-bold tracking-wide text-[#e30613] shadow-sm">
                      {initials(requester.name, requester.contact)}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-slate-900">
                          {requester.name}
                        </h3>
                        <AuthorizationStatusBadge status={request.status} />
                        {requester.badge ? (
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            Badge {requester.badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                        {requester.department ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-slate-400" />
                            {requester.department}
                          </span>
                        ) : null}
                        {requester.contact ? (
                          <span className="inline-flex items-center gap-1.5 truncate">
                            <UserRound className="size-3.5 text-slate-400" />
                            {requester.contact}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 font-medium text-slate-700">
                          <Car className="size-3.5 text-[#e30613]" />
                          {plate}
                        </span>
                        <span className="text-slate-600">{model}</span>
                      </div>
                      {request.purpose ? (
                        <p className="line-clamp-1 text-sm text-slate-500">
                          {request.purpose}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {isPending ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full bg-emerald-600 shadow-[0_10px_24px_-12px_rgba(5,150,105,0.8)] hover:bg-emerald-700"
                          disabled={pending}
                          onClick={() => onApprove(request.id)}
                        >
                          <Check className="size-3.5" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          disabled={pending}
                          onClick={() => {
                            setReason("");
                            setRejectId(request.id);
                          }}
                        >
                          <X className="size-3.5" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      render={<Link href={`/history/${request.id}`} />}
                    >
                      Details
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-600">
                    <CalendarRange className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {formatDate(request.start_date)} →{" "}
                      {formatDate(request.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-600">
                    <Timer className="size-4 shrink-0 text-slate-400" />
                    <span className="truncate">{request.duration_label}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-600">
                    <Clock3 className="size-4 shrink-0 text-slate-400" />
                    <span>After {usage}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={rejectId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>
              A rejection reason is required and will be shared with the
              requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="quick_rejection_reason">Reason</Label>
            <Textarea
              id="quick_rejection_reason"
              value={reason}
              disabled={pending}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this request is rejected"
              className="min-h-28 rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => setRejectId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-full"
              disabled={pending}
              onClick={onRejectConfirm}
            >
              {pending ? "Rejecting…" : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
