"use client";

import {
  AlertTriangle,
  Check,
  Clock3,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";

import type { GateVerificationResultData } from "@/lib/authorizations/gate-verification";
import { isExtendedUsageAfter } from "@/lib/business-date";
import { useI18n } from "@/lib/i18n/client";
import { plateLabel } from "@/components/vehicles/plate-label";

const statePresentation = {
  valid: {
    icon: ShieldCheck,
    palette: {
      panel: "border-emerald-200 bg-emerald-50",
      icon: "bg-emerald-600 text-white",
      eyebrow: "text-emerald-800",
      headline: "text-emerald-950",
      rule: "bg-emerald-500",
    },
  },
  not_yet_valid: {
    icon: Clock3,
    palette: {
      panel: "border-amber-200 bg-amber-50",
      icon: "bg-amber-500 text-white",
      eyebrow: "text-amber-800",
      headline: "text-amber-950",
      rule: "bg-amber-500",
    },
  },
  invalid: {
    icon: X,
    palette: {
      panel: "border-rose-200 bg-rose-50",
      icon: "bg-[#C8102E] text-white",
      eyebrow: "text-rose-800",
      headline: "text-rose-950",
      rule: "bg-[#C8102E]",
    },
  },
  unavailable: {
    icon: AlertTriangle,
    palette: {
      panel: "border-rose-200 bg-rose-50",
      icon: "bg-[#C8102E] text-white",
      eyebrow: "text-rose-800",
      headline: "text-rose-950",
      rule: "bg-[#C8102E]",
    },
  },
} as const;

export function GateVerificationResult({
  result,
}: {
  result: GateVerificationResultData;
}) {
  const { t, intl, tm } = useI18n();
  const copy = t.public.gate;
  const presentation = statePresentation[result.state];
  const stateCopy = copy.states[result.state];
  const StatusIcon = presentation.icon;
  const checkedAt = formatSaudiTime(result.checkedAt, intl) ?? copy.timeUnavailable;
  const details = result.state === "valid" ? result.details : undefined;
  const plate = details
    ? plateLabel({ plate_number: details.plate, door_number: details.doorNumber })
    : "";

  return (
    <section
      aria-live="polite"
      className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_-30px_rgba(15,23,42,0.35)]"
    >
      <div className={`h-1.5 w-full ${presentation.palette.rule}`} />

      <div className="p-5 sm:p-7">
        <div
          className={`rounded-xl border p-5 sm:p-6 ${presentation.palette.panel}`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`flex size-12 shrink-0 items-center justify-center rounded-full shadow-sm ${presentation.palette.icon}`}
              aria-hidden="true"
            >
              <StatusIcon className="size-6" strokeWidth={2.5} />
            </div>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-[11px] font-bold tracking-[0.16em] uppercase ${presentation.palette.eyebrow}`}
              >
                {stateCopy.label}
              </p>
              <h1
                className={`mt-2 text-[clamp(1.65rem,7vw,2.4rem)] leading-[1.05] font-black tracking-[-0.045em] ${presentation.palette.headline}`}
              >
                {stateCopy.headline}
              </h1>
            </div>
          </div>

          {result.state !== "valid" && (
            <p className="mt-5 border-t border-current/15 pt-4 text-sm leading-6 text-slate-800">
              {tm(result.reason)}
            </p>
          )}
        </div>

        {details && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-800"
              >
                <Check className="size-3.5" strokeWidth={3} />
              </span>
              <h2 className="text-xs font-bold tracking-[0.12em] text-slate-700 uppercase">
                {copy.compareHeading}
              </h2>
            </div>

            <dl className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
              <ComparisonRow label={copy.driver} value={details.driver} />
              {details.badge && (
                <ComparisonRow label={copy.badge} value={details.badge} />
              )}
              <ComparisonRow
                label={copy.doorNumber}
                value={details.doorNumber ?? t.public.vehicle.unavailable}
              />
              <ComparisonRow
                label={copy.vehiclePlate}
                value={plate === "Plate unavailable" ? t.public.vehicle.plateUnavailable : plate}
              />
              <ComparisonRow label={copy.vehicle} value={details.vehicle} />
              <ComparisonRow label={copy.validFrom} value={details.startDate} />
              <ComparisonRow label={copy.validThrough} value={details.endDate} />
              <ComparisonRow
                label={t.common.extendedTime.usageAfter}
                value={`${details.usageAfter} ${t.common.saudiTime}${
                  isExtendedUsageAfter(details.usageAfter)
                    ? ` · ${t.common.extendedTime.badge}`
                    : ""
                }`}
              />
              <ComparisonRow label={copy.reference} value={details.reference} />
              {details.location && (
                <div className="flex items-start gap-3 bg-slate-50/70 px-4 py-3.5">
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-slate-500"
                  />
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                      {copy.location}
                    </dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-900">
                      {details.location}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="mt-6 rounded-xl border border-[#eadfc9] bg-[#fbf7ef] px-4 py-4">
          <p className="text-sm leading-6 font-semibold text-slate-900">
            {copy.instructions}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">
            {`LVAS · ${t.common.companyName}`}
          </span>
          <span>
            {copy.checked(checkedAt)} <span className="text-slate-400">·</span>{" "}
            {copy.saudiTimeOffset}
          </span>
        </div>
      </div>
    </section>
  );
}

function ComparisonRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1.3fr)] gap-3 bg-white px-4 py-3.5">
      <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-end text-sm font-bold text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function formatSaudiTime(value: string, intl: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(intl, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
}
