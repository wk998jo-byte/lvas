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
import { getI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { AuthorizationStatus } from "@/types/database";
import { plateLabel } from "@/lib/vehicles/identity";

export const dynamic = "force-dynamic";

type HomeCopy = Dictionary["dashboard"]["home"];

type VehicleRef = {
  door_number: string | null;
  plate_number: string | null;
  make: string;
  model: string;
} | null;

function formatDate(value: string, intl: string): string {
  try {
    return new Intl.DateTimeFormat(intl, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function firstName(fullName: string, email: string, fallback: string): string {
  const name = fullName?.trim();
  if (name) return name.split(/\s+/)[0]!;
  return email.split("@")[0] ?? fallback;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function vehicleLabel(vehicle: VehicleRef, copy: HomeCopy): string {
  if (!vehicle) return copy.vehicleFallback;
  return `${vehicle.make} ${vehicle.model}`;
}

function compactIdentity(vehicle: VehicleRef, copy: HomeCopy): string {
  if (!vehicle) return copy.vehicleFallback;
  return `${vehicle.door_number ? copy.doorPrefix(vehicle.door_number) : ""}${plateLabel(vehicle)}`;
}

export default async function DashboardHomePage() {
  const profile = await requireRole(["admin", "logistics_approver"]);
  const { t, locale, intl } = await getI18n();
  const copy = t.dashboard.home;
  const isLogistics = profile.role === "logistics_approver";
  const locations = isLogistics
    ? await listLocationsForApprover(profile.id)
    : undefined;
  const adminId = isLogistics ? undefined : profile.id;
  const reviewFilter = isLogistics
    ? { stage: 1, locations: locations ?? [] }
    : { stage: 2, approverId: profile.id };

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
    getDashboardKpis(locations, adminId),
    listPendingAuthorizations(200, reviewFilter),
    isLogistics
      ? listLogisticsWaitingForFinalApproval(locations ?? [], 200)
      : Promise.resolve([]),
    listExpiringAuthorizations({ today, in7Days, limit: 6, locations, approverId: adminId }),
    listInsightAuthorizations(`${since90Days}T00:00:00.000Z`, 500, locations, adminId),
    countAuthorizationsByStatus("pending", locations, adminId),
    countAuthorizationsByStatus("approved", locations, adminId),
    countAuthorizationsByStatus("rejected", locations, adminId),
    countAuthorizationsByStatus("cancelled", locations, adminId),
    countAuthorizationsByStatus("expired", locations, adminId),
  ]);

  const status = t.common.status;
  const breakdown: BreakdownItem[] = [
    { label: status.pending, value: pendingCount, barClass: "bg-amber-500" },
    {
      label: status.approved,
      value: approvedCount,
      barClass: "bg-emerald-500",
    },
    { label: status.rejected, value: rejectedCount, barClass: "bg-rose-500" },
    {
      label: status.cancelled,
      value: cancelledCount,
      barClass: "bg-slate-400",
    },
    { label: status.expired, value: expiredCount, barClass: "bg-slate-300" },
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
          className="pointer-events-none absolute -top-24 end-6 size-48 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#e30613] uppercase rtl:tracking-normal">
              <Sparkles className="size-3.5" />
              {isLogistics ? copy.badgeLogistics : copy.badgeAdmin}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {copy.welcomeBack}{firstName(profile.full_name, profile.email, copy.nameFallback)}
            </h1>
            <p className="max-w-2xl text-sm text-slate-500 md:text-base">
              {isLogistics ? copy.introLogistics : copy.introAdmin}
            </p>
            <p className="text-xs tracking-wide text-slate-400 uppercase rtl:tracking-normal">
              {formatDate(today, intl)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              render={<Link href="/history" />}
            >
              <History className="size-4" />
              {copy.historyButton}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              render={<Link href="/request" target="_blank" />}
            >
              <Link2 className="size-4" />
              {copy.publicFormButton}
            </Button>
          </div>
        </div>
      </section>

      <KpiCards
        stats={{
          ...stats,
          pendingApprovals: await countPendingForReview(reviewFilter),
        }}
        pendingLabel={copy.pendingKpiLabel}
      />

      {/* Queue with inline decisions */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            {copy.queueTitle}
          </h2>
          <p className="text-sm text-slate-500">
            {queue.length}{copy.queuePending}
            {isLogistics ? copy.queueHintLogistics : copy.queueHintAdmin}
            <Link
              href="/history"
              className="font-medium text-[#e30613] underline-offset-4 hover:underline"
            >
              {copy.queueHistoryLink}
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
              {copy.waitingTitle}
            </h2>
            <p className="text-sm text-slate-500">
              {copy.waitingCount(waitingForFinalApproval.length)}
            </p>
          </div>
          {waitingForFinalApproval.length === 0 ? (
            <div className="glass-panel rounded-2xl px-5 py-6 text-center text-sm text-slate-500">
              {copy.waitingEmpty}
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
                      {compactIdentity(request.vehicles, copy)}
                      <span className="ms-2 font-normal text-slate-500">
                        {request.employees?.full_name ?? request.requester?.full_name ?? copy.requesterFallback}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.location ?? copy.locationFallback}
                      {request.first_approver?.full_name
                        ? copy.logisticsApprovedBy(request.first_approver.full_name)
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      {t.common.approval.waitingFinal}
                    </span>
                    {request.first_approved_at ? (
                      <span className="text-xs text-slate-500">
                        {formatDecisionTime(request.first_approved_at, locale)}
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
          meta={expiring.length > 0 ? copy.expiringMeta(expiring.length) : undefined}
          title={copy.expiringTitle}
          description={copy.expiringDescription}
          href="/history"
          linkLabel={copy.openHistory}
        >
          {expiring.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {copy.expiringEmpty}
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
                        {compactIdentity(vehicle, copy)}
                        <span className="ms-2 font-normal text-slate-500">
                          {vehicleLabel(vehicle, copy)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {copy.ends(formatDate(item.end_date, intl))}
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
                      {daysLeft === 0 ? copy.endsToday : copy.daysLeft(daysLeft)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={copy.statusTitle}
          description={
            isLogistics ? copy.statusDescLogistics : copy.statusDescAdmin
          }
        >
          <StatusBreakdown items={breakdown} />
        </SectionCard>
      </div>

      {/* Insights */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {copy.insightsTitle}
          </h2>
          <p className="text-xs text-slate-500">
            {copy.insightsDescription}
          </p>
        </header>
        <div className="grid divide-slate-100 sm:grid-cols-2 sm:divide-x xl:grid-cols-4">
          <InsightTile
            label={copy.submitted}
            value={insights.total.toString()}
            hint={copy.submittedHint(insights.decided, insights.pending)}
          />
          <InsightTile
            label={copy.approvalRate}
            value={insights.decided === 0 ? "—" : `${insights.approvalRate}%`}
            hint={
              insights.decided === 0
                ? copy.noDecisions
                : copy.approvedRejected(insights.approved, insights.rejected)
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
            label={copy.avgDecision}
            value={
              insights.avgDecisionHours === null
                ? "—"
                : formatHours(insights.avgDecisionHours, copy)
            }
            hint={
              insights.avgDecisionHours === null
                ? copy.waitingFirstDecision
                : copy.decisionSpan
            }
          />
          <InsightTile
            label={copy.topVehicle}
            value={
              insights.topVehicle
                ? `${insights.topVehicle.doorNumber ? `${insights.topVehicle.doorNumber} · ` : ""}${insights.topVehicle.plate}`
                : "—"
            }
            hint={
              insights.topVehicle
                ? copy.topVehicleHint(insights.topVehicle.count)
                : copy.noRequestsPeriod
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
    | { id?: string; door_number: string | null; plate_number: string | null }
    | { id?: string; door_number: string | null; plate_number: string | null }[]
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

  const vehicleCounts = new Map<string, { count: number; doorNumber: string | null; plate: string }>();
  rows.forEach((row, index) => {
    const vehicle = one(row.vehicles);
    if (!vehicle) return;
    const key = vehicle.id
      ? `id:${vehicle.id}`
      : vehicle.door_number?.trim()
        ? `door:${vehicle.door_number.trim().toLowerCase()}`
        : vehicle.plate_number?.trim()
          ? `plate:${vehicle.plate_number.trim().toLowerCase()}`
          : `row:${index}`;
    const existing = vehicleCounts.get(key);
    vehicleCounts.set(key, {
      count: (existing?.count ?? 0) + 1,
      doorNumber: vehicle.door_number,
      plate: plateLabel(vehicle),
    });
  });
  const top = [...vehicleCounts.values()].sort((a, b) => b.count - a.count)[0];

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
          plate: top.plate,
          doorNumber: top.doorNumber,
          count: top.count,
        }
      : null,
  };
}

function formatHours(hours: number, copy: HomeCopy): string {
  if (hours < 1) return copy.minutes(Math.max(1, Math.round(hours * 60)));
  if (hours < 48) return copy.hours(hours.toFixed(1));
  return copy.days((hours / 24).toFixed(1));
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
      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase rtl:tracking-normal">
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
