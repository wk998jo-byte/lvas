import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Clock3,
  Mail,
  Timer,
  UserRound,
  XCircle,
} from "lucide-react";

import { AuthorizationStatusBadge } from "@/components/authorizations/status-badge";
import { DigitalAuthorizationPass } from "@/components/authorizations/digital-pass";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  resolveRequester,
  type RequesterEmployeeRef,
} from "@/lib/authorizations/requester";
import { cn } from "@/lib/utils";
import type { Authorization, Profile, Vehicle } from "@/types/database";

export type AuthorizationDetailVehicle = Pick<
  Vehicle,
  "id" | "plate_number" | "make" | "model" | "year" | "color"
>;

export type AuthorizationDetailPerson = Pick<
  Profile,
  "full_name" | "email" | "department"
>;

export type AuthorizationDetailData = Authorization & {
  vehicles: AuthorizationDetailVehicle | AuthorizationDetailVehicle[] | null;
  requester: AuthorizationDetailPerson | AuthorizationDetailPerson[] | null;
  employees?: RequesterEmployeeRef | RequesterEmployeeRef[];
  approver?: AuthorizationDetailPerson | AuthorizationDetailPerson[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatUsageAfter(value: string): string {
  return typeof value === "string" ? value.slice(0, 5) : value;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

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

function InfoTile({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        accent
          ? "border-[#e30613]/15 bg-gradient-to-br from-red-50 to-white"
          : "border-slate-200/80 bg-white/70",
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-slate-500">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-xl border",
            accent
              ? "border-red-100 bg-white text-[#e30613]"
              : "border-slate-200 bg-slate-50 text-slate-500",
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.16em] uppercase">
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-base font-semibold tracking-tight",
          accent ? "text-[#991b1b]" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          {label}
        </p>
        <div className="text-sm font-medium text-slate-800">{children}</div>
      </div>
    </div>
  );
}

type AuthorizationDetailViewProps = {
  request: AuthorizationDetailData;
  breadcrumb: { href: string; label: string };
  title: string;
  actions?: ReactNode;
};

export function AuthorizationDetailView({
  request,
  breadcrumb,
  title,
  actions,
}: AuthorizationDetailViewProps) {
  const vehicle = one(request.vehicles);
  const requester = resolveRequester({
    profile: request.requester,
    employee: request.employees,
    contactMobile: request.contact_mobile,
  });
  const approver = one(request.approver);
  const usage = formatUsageAfter(request.usage_after);
  const plate = vehicle?.plate_number ?? "Request";

  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          render={<Link href={breadcrumb.href} />}
        >
          <ArrowLeft className="size-3.5" />
          Back to {breadcrumb.label.toLowerCase()}
        </Button>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <section className="glass-panel-strong relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/55 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 size-56 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <AuthorizationStatusBadge status={request.status} />
            <span className="text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">
              After-hours authorization
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              {title}
            </h1>
            <p className="text-base text-slate-600 md:text-lg">
              {plate}
              {request.duration_label ? ` · ${request.duration_label}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={CalendarDays}
          label="Start date"
          value={formatDate(request.start_date)}
        />
        <InfoTile
          icon={CalendarDays}
          label="End date"
          value={formatDate(request.end_date)}
        />
        <InfoTile
          icon={Timer}
          label="Duration"
          value={request.duration_label}
        />
        <InfoTile
          icon={Clock3}
          label="Usage after"
          value={usage}
          accent
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Car className="size-4 text-[#e30613]" />
              Vehicle
            </CardTitle>
            <CardDescription>
              Fleet vehicle assigned to this authorization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {vehicle ? (
              <>
                <DetailRow icon={<Car className="size-4" />} label="Plate">
                  <Link
                    href={`/vehicles/${vehicle.id}`}
                    className="text-[#e30613] underline-offset-4 hover:underline"
                  >
                    {vehicle.plate_number}
                  </Link>
                </DetailRow>
                <DetailRow icon={<Car className="size-4" />} label="Vehicle">
                  {vehicle.make} {vehicle.model}
                  {vehicle.year ? ` · ${vehicle.year}` : ""}
                  {vehicle.color ? ` · ${vehicle.color}` : ""}
                </DetailRow>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Vehicle details unavailable.
              </p>
            )}
            {request.purpose ? (
              <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-3">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Purpose
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {request.purpose}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-[#e30613]" />
              Requester
            </CardTitle>
            <CardDescription>
              Employee who submitted this authorization request.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <DetailRow icon={<UserRound className="size-4" />} label="Name">
              {requester.name}
              {requester.badge ? (
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  Badge {requester.badge} · submitted via public form
                </span>
              ) : null}
            </DetailRow>
            <DetailRow
              icon={<Mail className="size-4" />}
              label={requester.source === "public" ? "Mobile" : "Email"}
            >
              {requester.contact ? (
                <a
                  href={
                    requester.source === "public"
                      ? `tel:${requester.contact}`
                      : `mailto:${requester.contact}`
                  }
                  className="text-[#e30613] underline-offset-4 hover:underline"
                >
                  {requester.contact}
                </a>
              ) : (
                "—"
              )}
            </DetailRow>
            <DetailRow
              icon={<Building2 className="size-4" />}
              label="Department"
            >
              {requester.department?.trim() || "—"}
            </DetailRow>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-[#e30613]" />
              Approval timeline
            </CardTitle>
            <CardDescription>
              Submission and decision milestones for this request.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailRow icon={<UserRound className="size-4" />} label="Approver">
              {approver?.full_name?.trim() ||
                (request.approver_id ? "Muteb" : "Unassigned")}
              {approver?.email ? (
                <span className="mt-0.5 block text-xs font-normal text-slate-500">
                  {approver.email}
                </span>
              ) : null}
            </DetailRow>
            <DetailRow
              icon={<CalendarDays className="size-4" />}
              label="Submitted"
            >
              {formatDateTime(request.created_at)}
            </DetailRow>
            {request.approved_at ? (
              <DetailRow
                icon={<CheckCircle2 className="size-4 text-emerald-600" />}
                label="Approved at"
              >
                {formatDateTime(request.approved_at)}
              </DetailRow>
            ) : null}
            {request.rejected_at ? (
              <DetailRow
                icon={<XCircle className="size-4 text-rose-600" />}
                label="Rejected at"
              >
                {formatDateTime(request.rejected_at)}
              </DetailRow>
            ) : null}
            {request.rejection_reason ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 md:col-span-2 xl:col-span-4">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-rose-700 uppercase">
                  Rejection reason
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-rose-900">
                  {request.rejection_reason}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <DigitalAuthorizationPass request={request} />
    </div>
  );
}
