import Link from "next/link";

import { History, Link2, Sparkles, TriangleAlert } from "lucide-react";

import { addCalendarDays, saudiTodayIsoDate } from "@/lib/business-date";
import { requireRole } from "@/lib/auth/guards";
import { getDashboardKpis } from "@/lib/dashboard/stats";
import {
  countAuthorizationsByStatus,
  countPendingForReview,
  listExpiringAuthorizations,
  listInsightAuthorizations,
  listLogisticsWaitingForFinalApproval,
  listLocationsForApprover,
  listPendingAuthorizations,
} from "@/lib/db/queries";
import { formatDecisionTime } from "@/lib/approvals/presentation";
import { inclusiveDayCount } from "@/lib/dates";
import {
  ApprovalsTable,
} from "@/components/approvals/approvals-table";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  StatusBreakdown,
  type BreakdownItem,
} from "@/components/dashboard/status-breakdown";
import { Button } from "@/components/ui/button";
import type { AuthorizationStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type VehicleRef = {
  door_number: string | null;
  plate_number: string;
  make: string;
  model: string;
} | null;

function formatDate(value: string): string {
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

function firstName(fullName: string, email: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0] ?? "there";
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function vehicleLabel(vehicle: VehicleRef): string {
  if (!vehicle) return "Vehicle";
  return `${vehicle.make} ${vehicle.model}`;
}

function compactIdentity(vehicle: VehicleRef): string {
  if (!vehicle) return "Vehicle";
  return `${vehicle.door_number ? `Door ${vehicle.door_number} · ` : ""}Plate ${vehicle.plate_number}`;
}

export default async function DashboardHomePage() {
  const profile = await requireRole(["admin", "logistics_approver"]);
  const isLogistics = profile.role === "logistics_approver";
  const locations = isLogistics
    ? await listLocationsForApprover(profile.id)
    : undefined;
  const reviewFilter = isLogistics
    ? { stage: 1, locations: locations ?? [] }
    : { stage: 2 };

  const today = saudiTodayIsoDate();
  const in7Days = addCalendarDays(today, 7);
  const since90Days = addCalendarDays(today, -90);

  const [
    stats,
    queue,
    waitingForFinalApproval,
    expiring,
    insightsRows,
    pendingCount,
    approvedCount,
    rejectedCount,
    cancelledCount,
    expiredCount,
  ] = await Promise.all([
    getDashboardKpis(locations),
    listPendingAuthorizations(200, reviewFilter),
    isLogistics
      ? listLogisticsWaitingForFinalApproval(locations ?? [], 200)
      : Promise.resolve([]),
    listExpiringAuthorizations({ today, in7Days, limit: 6, locations }),
    listInsightAuthorizations(`${since90Days}T00:00:00.000Z`, 500, locations),
    countAuthorizationsByStatus("pending", locations),
    countAuthorizationsByStatus("approved", locations),
    countAuthorizationsByStatus("rejected", locations),
    countAuthorizationsByStatus("cancelled", locations),
    countAuthorizationsByStatus("expired", locations),
  ]);

  const breakdown: BreakdownItem[] = [
    { label: "Pending", value: pendingCount, barClass: "bg-amber-500" },
    {
      label: "Approved",
      value: approvedCount,
      barClass: "bg-emerald-500",
    },
    { label: "Rejected", value: rejectedCount, barClass: "bg-rose-500" },
    {
      label: "Cancelled",
      value: cancelledCount,
      barClass: "bg-slate-400",
    },
    { label: "Expired", value: expiredCount, barClass: "bg-slate-300" },
  ];

  const insights = summarizeInsights(insightsRows as unknown as InsightRow[]);

  return (
    <div className="space-y-6 animate-rise">
      {/* Hero */}
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/45 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-6 size-48 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#e30613] uppercase">
              <Sparkles className="size-3.5" />
              {isLogistics ? "Logistics approval" : "Admin dashboard"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Welcome back, {firstName(profile.full_name, profile.email)}
            </h1>
            <p className="max-w-2xl text-sm text-slate-500 md:text-base">
              {isLogistics
                ? "These requests are waiting for the first approval at your project locations. After you approve, they go to the final approver."
                : "These requests already have logistics approval and are waiting for your final decision."}
            </p>
            <p className="text-xs tracking-wide text-slate-400 uppercase">
              {formatDate(today)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              render={<Link href="/history" />}
            >
              <History className="size-4" />
              Requests history
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              render={<Link href="/request" target="_blank" />}
            >
              <Link2 className="size-4" />
              Public request form
            </Button>
          </div>
        </div>
      </section>

      <KpiCards
        stats={{
          ...stats,
          pendingApprovals: await countPendingForReview(reviewFilter),
        }}
        pendingLabel="Awaiting decision"
      />

      {/* Queue with inline decisions */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Requests awaiting decision
          </h2>
          <p className="text-sm text-slate-500">
            {queue.length} pending
            {isLogistics
              ? " · approve here, then the request goes to final approval · "
              : " · decided requests move to "}
            <Link
              href="/history"
              className="font-medium text-[#e30613] underline-offset-4 hover:underline"
            >
              requests history
            </Link>
          </p>
        </div>
        <ApprovalsTable
          requests={queue}
          mode="queue"
          canEndAuthorization={!isLogistics}
        />
      </section>

      {isLogistics ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Waiting for final approval
            </h2>
            <p className="text-sm text-slate-500">
              {waitingForFinalApproval.length} request
              {waitingForFinalApproval.length === 1 ? "" : "s"} · read only
            </p>
          </div>
          {waitingForFinalApproval.length === 0 ? (
            <div className="glass-panel rounded-2xl px-5 py-6 text-center text-sm text-slate-500">
              No requests are waiting for final approval at your assigned locations.
            </div>
          ) : (
            <div className="grid gap-3">
              {waitingForFinalApproval.map((request) => (
                <Link
                  key={request.id}
                  href={`/history/${request.id}`}
                  className="glass-panel flex flex-col gap-3 rounded-2xl p-4 transition hover:border-[#e30613]/25 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {compactIdentity(request.vehicles)}
                      <span className="ml-2 font-normal text-slate-500">
                        {request.employees?.full_name ?? request.requester?.full_name ?? "Requester"}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.location ?? "Assigned location"}
                      {request.first_approver?.full_name
                        ? ` · Logistics approved by ${request.first_approver.full_name}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      Logistics approved — waiting for final approval
                    </span>
                    {request.first_approved_at ? (
                      <span className="text-xs text-slate-500">
                        {formatDecisionTime(request.first_approved_at)}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-3">
        <SectionCard
          className="xl:col-span-2"
          meta={expiring.length > 0 ? `${expiring.length} soon` : undefined}
          title="Expiring within 7 days"
          description="Approved authorizations that need renewal attention"
          href="/history"
          linkLabel="Open history"
        >
          {expiring.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Nothing expires in the next 7 days.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expiring.map((item) => {
                const vehicle = one(item.vehicles);
                const daysLeft = Math.max(
                  0,
                  inclusiveDayCount(today, item.end_date) - 1,
                );
                const urgent = daysLeft <= 2;
                return (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {compactIdentity(vehicle)}
                        <span className="ml-2 font-normal text-slate-500">
                          {vehicleLabel(vehicle)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        Ends {formatDate(item.end_date)}
                      </p>
                    </div>
                    <span
                      className={
                        urgent
                          ? "inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                          : "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      <TriangleAlert className="size-3.5" />
                      {daysLeft === 0
                        ? "Ends today"
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Status breakdown"
          description="All authorizations in the system"
        >
          <StatusBreakdown items={breakdown} />
        </SectionCard>
      </div>

      {/* Insights */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Last 90 days
          </h2>
          <p className="text-xs text-slate-500">
            Decision performance across the fleet
          </p>
        </header>
        <div className="grid divide-slate-100 sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
          <InsightTile
            label="Requests submitted"
            value={insights.total.toString()}
            hint={`${insights.decided} decided · ${insights.pending} still pending`}
          />
          <InsightTile
            label="Approval rate"
            value={insights.decided === 0 ? "—" : `${insights.approvalRate}%`}
            hint={
              insights.decided === 0
                ? "No decisions recorded yet"
                : `${insights.approved} approved · ${insights.rejected} rejected`
            }
            tone={
              insights.decided === 0
                ? "neutral"
                : insights.approvalRate >= 70
                  ? "positive"
                  : "warning"
            }
          />
          <InsightTile
            label="Average decision time"
            value={
              insights.avgDecisionHours === null
                ? "—"
                : formatHours(insights.avgDecisionHours)
            }
            hint={
              insights.avgDecisionHours === null
                ? "Waiting on the first decision"
                : "From submission to approve or reject"
            }
          />
          <InsightTile
            label="Most requested vehicle"
            value={
              insights.topVehicle
                ? `${insights.topVehicle.doorNumber ? `${insights.topVehicle.doorNumber} · ` : ""}${insights.topVehicle.plate}`
                : "—"
            }
            hint={
              insights.topVehicle
                ? `${insights.topVehicle.count} request${
                    insights.topVehicle.count === 1 ? "" : "s"
                  } in this period`
                : "No requests in this period"
            }
          />
        </div>
      </section>
    </div>
  );
}

type InsightRow = {
  status: AuthorizationStatus;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  vehicles:
    | { door_number: string | null; plate_number: string }
    | { door_number: string | null; plate_number: string }[]
    | null;
};

function summarizeInsights(rows: InsightRow[]) {
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "rejected").length;
  const pending = rows.filter((row) => row.status === "pending").length;
  const decided = approved + rejected;

  const decisionHours = rows
    .map((row) => {
      const decidedAt = row.approved_at ?? row.rejected_at;
      if (!decidedAt) return null;
      const delta =
        new Date(decidedAt).getTime() - new Date(row.created_at).getTime();
      return delta >= 0 ? delta / 3_600_000 : null;
    })
    .filter((value): value is number => value !== null);

  const plateCounts = new Map<string, number>();
  const plateDoors = new Map<string, string | null>();
  for (const row of rows) {
    const vehicle = one(row.vehicles);
    const plate = vehicle?.plate_number;
    if (!plate) continue;
    plateCounts.set(plate, (plateCounts.get(plate) ?? 0) + 1);
    plateDoors.set(plate, vehicle.door_number);
  }
  const top = [...plateCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    total: rows.length,
    approved,
    rejected,
    pending,
    decided,
    approvalRate: decided === 0 ? 0 : Math.round((approved / decided) * 100),
    avgDecisionHours:
      decisionHours.length === 0
        ? null
        : decisionHours.reduce((sum, value) => sum + value, 0) /
          decisionHours.length,
    topVehicle: top
      ? {
          plate: top[0],
          doorNumber: plateDoors.get(top[0]) ?? null,
          count: top[1],
        }
      : null,
  };
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function InsightTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  const valueTone =
    tone === "positive"
      ? "text-emerald-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-slate-900";

  return (
    <div className="border-b border-slate-100 p-5 last:border-b-0 sm:border-b-0">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        {label}
      </p>
      <p
        className={`mt-2 truncate text-2xl font-semibold tabular-nums ${valueTone}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}
