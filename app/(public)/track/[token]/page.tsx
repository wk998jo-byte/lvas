import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Copy } from "lucide-react";

import { AuthorizationStatusBadge } from "@/components/authorizations/status-badge";
import { PublicPass } from "@/components/public/public-pass";
import { Button } from "@/components/ui/button";
import { pendingStageLabel } from "@/lib/approvals/logistics-team";
import { effectiveAuthorizationStatus } from "@/lib/authorizations/effective-status";
import { saudiTodayIsoDate } from "@/lib/business-date";
import { getAuthorizationByPublicToken } from "@/lib/db/queries";
import { publicTokenSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const STATUS_HINT: Record<string, string> = {
  pending: "Waiting for review.",
  approved: "Approved. Show the pass below at the gate.",
  rejected: "This request was rejected.",
  expired: "This authorization has expired.",
  cancelled: "This authorization has ended.",
};

export default async function TrackRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = publicTokenSchema.safeParse({ token });
  if (!parsed.success) notFound();

  const request = await getAuthorizationByPublicToken(parsed.data.token);

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

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Request {reference}
          </h1>
          <AuthorizationStatusBadge
            status={status}
            label={
              status === "pending"
                ? pendingStageLabel(request.approval_stage)
                : undefined
            }
          />
        </div>
        <p className="text-sm text-slate-600">
          {status === "pending"
            ? request.approval_stage === 1
              ? "Waiting for the logistics supervisor to review your request."
              : "Logistics approved this request. Waiting for final approval."
            : (STATUS_HINT[status] ?? "")}
        </p>
        <p className="inline-flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
          <Copy className="size-3.5" />
          Bookmark this page, or look up every request for your badge on{" "}
          <Link
            href="/status"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            Track requests
          </Link>
          .
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            Request details
          </h2>
        </header>
        <dl className="grid gap-x-6 gap-y-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Requester" value={employee?.full_name ?? "—"} />
          <Field label="Badge" value={employee?.badge ?? "—"} />
          <Field
            label="Vehicle"
            value={
              vehicle
                ? `${vehicle.plate_number} — ${vehicle.make} ${vehicle.model}`
                : "—"
            }
          />
          <Field label="Location" value={request.location ?? "—"} />
          <Field
            label="Justification"
            value={request.justification ?? request.purpose ?? "—"}
          />
          <Field label="Duration" value={request.duration_label} />
          <Field
            label="Window"
            value={`${request.start_date} → ${request.end_date}`}
          />
          <Field label="Usage after" value={String(usageAfter)} />
          {request.purpose ? (
            <Field label="Purpose" value={request.purpose} />
          ) : null}
          {request.rejection_reason ? (
            <Field
              label="Rejection reason"
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
            plate: vehicle.plate_number,
            vehicle: `${vehicle.make} ${vehicle.model}`,
            driver: employee.full_name,
            badge: employee.badge,
            startDate: request.start_date,
            endDate: request.end_date,
            usageAfter: String(usageAfter),
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
          All my requests
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          render={<Link href="/request" />}
        >
          <ArrowLeft className="size-3.5" />
          Submit another request
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
