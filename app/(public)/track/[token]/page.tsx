import { consumeRateLimit, TOO_MANY_ATTEMPTS, SAFE_REQUEST_ERROR } from "@/lib/security/rate-limit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Copy } from "lucide-react";

import { AuthorizationStatusBadge } from "@/components/authorizations/status-badge";
import { PublicPass } from "@/components/public/public-pass";
import { Button } from "@/components/ui/button";
import { approvalStatusLabel } from "@/lib/approvals/presentation";
import { effectiveAuthorizationStatus } from "@/lib/authorizations/effective-status";
import { isExtendedUsageAfter, saudiTodayIsoDate } from "@/lib/business-date";
import { getAuthorizationByPublicToken } from "@/lib/db/queries";
import { getI18n } from "@/lib/i18n/server";
import { publicTokenSchema } from "@/lib/validations";
import { buildGateVerificationUrl } from "@/lib/authorizations/gate-url";
import { plateLabel } from "@/components/vehicles/plate-label";

export const dynamic = "force-dynamic";

export default async function TrackRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = publicTokenSchema.safeParse({ token });
  if (!parsed.success) notFound();

  const { t, locale, tm } = await getI18n();
  const copy = t.public.track;
  const vehicleCopy = t.public.vehicle;

  if (!(await consumeRateLimit("tokenTracking")).allowed) {
    return <p role="alert">{tm(TOO_MANY_ATTEMPTS)}</p>;
  }
  let request;
  try {
    request = await getAuthorizationByPublicToken(parsed.data.token);
  } catch {
    return <p role="alert">{tm(SAFE_REQUEST_ERROR)}</p>;
  }

  if (!request) notFound();

  const vehicle = Array.isArray(request.vehicles)
    ? request.vehicles[0]
    : request.vehicles;
  const employee = Array.isArray(request.employees)
    ? request.employees[0]
    : request.employees;
  const reference = request.id.slice(0, 8).toUpperCase();
  const usageAfter =
    typeof request.usage_after === "string"
      ? request.usage_after.slice(0, 5)
      : request.usage_after;
  const status = effectiveAuthorizationStatus(
    request.status,
    request.end_date,
    saudiTodayIsoDate(),
  );
  const statusHint: Partial<Record<string, string>> = copy.statusHint;
  const plate = vehicle ? plateLabel(vehicle) : "";
  const plateText = plate === "Plate unavailable" ? vehicleCopy.plateUnavailable : plate;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {copy.title(reference)}
          </h1>
          <AuthorizationStatusBadge
            status={status}
            label={approvalStatusLabel({ ...request, status }, locale)}
          />
        </div>
        <p className="text-sm text-slate-600">
          {status === "pending" || status === "rejected"
            ? approvalStatusLabel({ ...request, status }, locale)
            : (statusHint[status] ?? "")}
        </p>
        <p className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
          <Copy className="size-3.5" />
          {copy.bookmarkPrefix}{" "}
          <Link
            href="/status"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            {copy.trackRequests}
          </Link>
          {copy.bookmarkSuffix}
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {copy.detailsHeading}
          </h2>
        </header>
        <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
          <Field label={copy.requester} value={employee?.full_name ?? "—"} />
          <Field label={copy.badge} value={employee?.badge ?? "—"} />
          <Field
            label={copy.vehicle}
            value={
              vehicle
                ? `${vehicle.door_number ? vehicleCopy.door(vehicle.door_number) : vehicleCopy.doorUnavailable} — ${plateText} — ${vehicle.make} ${vehicle.model}`
                : "—"
            }
          />
          <Field label={copy.location} value={request.location ?? "—"} />
          <Field
            label={copy.justification}
            value={request.justification ?? request.purpose ?? "—"}
          />
          <Field label={copy.duration} value={request.duration_label} />
          <Field
            label={copy.window}
            value={`${request.start_date} ${t.common.dateRangeSeparator} ${request.end_date}`}
          />
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
              {t.common.extendedTime.usageAfter}
            </dt>
            <dd className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
              {String(usageAfter)}
              {isExtendedUsageAfter(String(usageAfter)) ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  {t.common.extendedTime.badge}
                </span>
              ) : null}
            </dd>
          </div>
          {request.purpose ? (
            <Field label={copy.purpose} value={request.purpose} />
          ) : null}
          {request.rejection_reason ? (
            <Field
              label={copy.rejectionReason}
              value={request.rejection_reason}
              tone="danger"
            />
          ) : null}
        </dl>
      </section>

      {status === "approved" && vehicle && employee ? (
        <PublicPass
          pass={{
            id: request.id,
            doorNumber: vehicle.door_number ?? null,
            plate: plateLabel(vehicle),
            vehicle: `${vehicle.make} ${vehicle.model}`,
            driver: employee.full_name,
            badge: employee.badge,
            startDate: request.start_date,
            endDate: request.end_date,
            usageAfter: String(usageAfter),
            verificationUrl: buildGateVerificationUrl(parsed.data.token),
          }}
        />
      ) : null}

      <div className="no-print flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="rounded-full"
          render={<Link href="/status" />}
        >
          <ClipboardList className="size-3.5" />
          {copy.allRequests}
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          render={<Link href="/request" />}
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {copy.submitAnother}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        {label}
      </dt>
      <dd
        className={
          tone === "danger"
            ? "text-sm font-medium text-rose-700"
            : "text-sm font-medium text-slate-800"
        }
      >
        {value}
      </dd>
    </div>
  );
}
