"use client";

import {
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  Clock3,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  submitPublicRequest,
  verifyEmployeeForRequest,
  type PublicEmployee,
} from "@/actions/public-requests";
import { PROJECT_LOCATIONS } from "@/lib/approvals/logistics-team";
import {
  durationExceedsLimit,
  EXTENDED_HOURS_LIMIT,
  getRoleRequestLimit,
  hasOneDayOrCustomDuration,
  type RoleRequestLimit,
} from "@/lib/authorizations/limits";
import { addCalendarDays, saudiTodayIsoDate } from "@/lib/business-date";
import { formatDurationLabel, inclusiveDayCount } from "@/lib/dates";
import { roleLabel } from "@/lib/auth/roles";
import { useI18n } from "@/lib/i18n/client";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  VehicleCombobox,
  type VehicleOption,
} from "@/components/vehicles/vehicle-combobox";
import { cn } from "@/lib/utils";

/** Extended hours: 19:00–21:00 on each date, up to 30 days, never combined with the standard window. */
type DurationMode = "one_day" | "custom" | "extended";

/** Latest end date allowed for the category, inclusive of the start date. */
function maxEndDate(startDate: string, limit: RoleRequestLimit | null) {
  if (!limit) return undefined;
  return addCalendarDays(startDate, limit.maxDurationDays - 1);
}

/** Translated cadence/window for the role's limit; null when exempt. */
function limitCopy(role: UserRole, limits: Dictionary["common"]["limits"]) {
  if (!getRoleRequestLimit(role)) return null;
  return role === "manager_requester"
    ? { cadence: limits.managerCadence, duration: limits.managerDuration }
    : { cadence: limits.dailyCadence, duration: limits.dailyDuration };
}

/** Identity carried between steps; the server re-verifies on submit. */
type VerifiedIdentity = {
  employee: PublicEmployee;
  idLast4: string;
  vehicles: VehicleOption[];
};

export function PublicRequestForm() {
  const router = useRouter();
  const { t } = useI18n();
  const [verified, setVerified] = useState<VerifiedIdentity | null>(null);

  return (
    <div className="space-y-4">
      <IdentityStep verified={verified} onVerified={setVerified} />
      {verified ? (
        <DetailsStep
          identity={verified}
          vehicles={verified.vehicles}
          onSubmitted={(token) => router.push(`/track/${token}`)}
        />
      ) : (
        <StepShell
          step="2"
          title={t.public.form.detailsTitle}
          description={t.public.form.detailsLocked}
          muted
        />
      )}
    </div>
  );
}

function IdentityStep({
  verified,
  onVerified,
}: {
  verified: VerifiedIdentity | null;
  onVerified: (identity: VerifiedIdentity | null) => void;
}) {
  const { t, locale, tm } = useI18n();
  const copy = t.public.form.identity;
  const [badge, setBadge] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const badgeValue = badge.trim();

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!badgeValue || idLast4.length !== 4) return;

    setError(null);
    startTransition(async () => {
      const result = await verifyEmployeeForRequest({
        badge: badgeValue,
        id_last4: idLast4,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setBadge("");
      setIdLast4("");
      onVerified({ ...result.data, idLast4 });
      toast.success(copy.welcome(result.data.employee.full_name.split(" ")[0]));
    });
  }

  if (verified) {
    const limit = limitCopy(verified.employee.role, t.common.limits);
    return (
      <StepShell
        step="1"
        title={copy.confirmedTitle}
        description={copy.confirmedDescription(
          verified.employee.full_name,
          verified.employee.badge,
        )}
        done
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="size-3.5" />
            {roleLabel(verified.employee.role, locale)}
          </span>
          {limit ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <Clock3 className="size-3.5" />
              {copy.limitSummary(limit.cadence, limit.duration)}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onVerified(null)}
          >
            {copy.notYou}
          </Button>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="1"
      title={copy.title}
      description={copy.description}
    >
      <form className="space-y-4" onSubmit={submitVerification}>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="badge">{copy.badgeLabel}</Label>
            <Input
              id="badge"
              name="badge"
              dir="ltr"
              value={badge}
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
              placeholder={copy.badgePlaceholder}
              className="h-11 rounded-xl"
              onChange={(e) => setBadge(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_last4">{copy.idLast4Label}</Label>
            <Input
              id="id_last4"
              name="id_last4"
              dir="ltr"
              inputMode="numeric"
              maxLength={4}
              value={idLast4}
              autoComplete="off"
              disabled={pending}
              placeholder="••••"
              className="h-11 rounded-xl tracking-[0.4em]"
              onChange={(e) =>
                setIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={!badgeValue || idLast4.length !== 4 || pending}
          >
            <ShieldCheck className="size-4" />
            {pending ? copy.verifying : copy.verify}
          </Button>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {tm(error)}
          </p>
        ) : null}
      </form>
    </StepShell>
  );
}

function DetailsStep({
  identity,
  vehicles,
  onSubmitted,
}: {
  identity: VerifiedIdentity;
  vehicles: VehicleOption[];
  onSubmitted: (token: string) => void;
}) {
  const { t, intl, tm } = useI18n();
  const copy = t.public.form.details;
  const { employee } = identity;
  const limit = getRoleRequestLimit(employee.role);
  const limitText = limitCopy(employee.role, t.common.limits);
  const useDurationPresets = hasOneDayOrCustomDuration(employee.role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleOption | null>(null);
  const [durationMode, setDurationMode] = useState<DurationMode>(
    useDurationPresets ? "one_day" : "custom",
  );
  const [startDate, setStartDate] = useState(saudiTodayIsoDate);
  const [endDate, setEndDate] = useState(saudiTodayIsoDate);
  const [durationTouched, setDurationTouched] = useState(false);
  const [durationLabel, setDurationLabel] = useState(() =>
    formatDurationLabel(saudiTodayIsoDate(), saudiTodayIsoDate()),
  );
  const [mobile, setMobile] = useState("");
  const [location, setLocation] = useState("");
  const [justification, setJustification] = useState("");

  const extendedHours = durationMode === "extended";
  const singleDay = durationMode === "one_day";
  const windowLimit = extendedHours ? EXTENDED_HOURS_LIMIT : limit;
  const modeOptions: Array<{ id: DurationMode; label: string }> = [
    ...(useDurationPresets
      ? [
          { id: "one_day" as const, label: copy.oneDay },
          { id: "custom" as const, label: copy.custom },
        ]
      : [{ id: "custom" as const, label: t.common.extendedHours.rangeOption }]),
    { id: "extended", label: t.common.extendedHours.option },
  ];

  const computedDuration = useMemo(
    () => formatDurationLabel(startDate, endDate),
    [startDate, endDate],
  );
  const selectedDays = inclusiveDayCount(startDate, endDate);
  const overLimit = windowLimit
    ? durationExceedsLimit(startDate, endDate, windowLimit)
    : false;

  function applyOneDay(nextStart = saudiTodayIsoDate()) {
    setDurationMode("one_day");
    setStartDate(nextStart);
    setEndDate(nextStart);
    setDurationTouched(false);
    setDurationLabel(formatDurationLabel(nextStart, nextStart));
  }

  function selectMode(mode: DurationMode) {
    if (mode === "one_day") {
      applyOneDay(startDate);
      return;
    }
    setDurationMode(mode);
    const capped = maxEndDate(startDate, mode === "extended" ? EXTENDED_HOURS_LIMIT : limit);
    if (capped && endDate > capped) {
      setEndDate(capped);
      syncDuration(startDate, capped);
    }
  }

  function syncDuration(nextStart: string, nextEnd: string) {
    if (!durationTouched) {
      setDurationLabel(formatDurationLabel(nextStart, nextEnd));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicle) {
      setError(copy.selectVehicle);
      return;
    }
    if (overLimit) {
      setError(
        extendedHours || !limit
          ? copy.overMonth(selectedDays)
          : copy.durationLimit(limitText?.duration ?? limit.durationLabel),
      );
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitPublicRequest({
        badge: employee.badge,
        id_last4: identity.idLast4,
        vehicle_id: vehicle.id,
        start_date: startDate,
        end_date: endDate,
        duration_label: durationLabel || computedDuration,
        purpose: justification,
        location,
        justification,
        contact_mobile: mobile,
        extended_hours: extendedHours,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(tm(result.error));
        return;
      }

      toast.success(copy.submitted);
      onSubmitted(result.data.token);
    });
  }

  return (
    <StepShell
      step="2"
      title={t.public.form.detailsTitle}
      description={copy.description}
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="vehicle">{copy.vehicle}</Label>
          <VehicleCombobox
            id="vehicle"
            vehicles={vehicles}
            value={vehicle}
            onValueChange={setVehicle}
            disabled={pending}
          />
          <p className="text-xs text-slate-500">
            {copy.vehicleHelp(vehicles.length.toLocaleString(intl))}
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{copy.duration}</Label>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={copy.duration}
            >
              {modeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={durationMode === option.id}
                  disabled={pending}
                  onClick={() => selectMode(option.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    durationMode === option.id
                      ? "border-[#e30613]/30 bg-[#e30613] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {option.id === "extended" ? <Clock3 className="size-3.5" /> : null}
                  {option.label}
                </button>
              ))}
            </div>
            {extendedHours ? (
              <p className="text-xs text-slate-500">{t.common.extendedHours.help}</p>
            ) : useDurationPresets ? (
              <p className="text-xs text-slate-500">{copy.presetHelp}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">{copy.startDate}</Label>
              <Input
                id="start_date"
                type="date"
                dir="ltr"
                required
                value={startDate}
                min={saudiTodayIsoDate()}
                disabled={pending}
                className="h-11 rounded-xl"
                onChange={(e) => {
                  const next = e.target.value;
                  if (durationMode === "one_day") {
                    applyOneDay(next);
                    return;
                  }
                  setStartDate(next);
                  const capped = maxEndDate(next, windowLimit);
                  const nextEnd =
                    capped && endDate > capped
                      ? capped
                      : endDate < next
                        ? next
                        : endDate;
                  setEndDate(nextEnd);
                  syncDuration(next, nextEnd);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">{copy.endDate}</Label>
              <Input
                id="end_date"
                type="date"
                dir="ltr"
                required
                value={endDate}
                min={startDate}
                max={maxEndDate(startDate, windowLimit)}
                disabled={pending || singleDay}
                className="h-11 rounded-xl"
                onChange={(e) => {
                  setEndDate(e.target.value);
                  syncDuration(startDate, e.target.value);
                }}
              />
              <DurationHint
                text={
                  extendedHours
                    ? overLimit
                      ? copy.overMonth(selectedDays)
                      : `${t.common.extendedHours.window} ${copy.selectedDays(selectedDays)}`
                    : durationMode === "one_day"
                      ? copy.singleDay
                      : useDurationPresets
                        ? overLimit
                          ? copy.overMonth(selectedDays)
                          : copy.selectedDays(selectedDays)
                        : limit
                          ? overLimit
                            ? copy.categoryOver(limitText?.duration ?? limit.durationLabel, selectedDays)
                            : copy.maxWindow(limitText?.duration ?? limit.durationLabel)
                          : null
                }
                warning={overLimit}
              />
            </div>
          </div>
        </div>

        {!useDurationPresets && !extendedHours ? (
          <div className="space-y-2">
            <Label htmlFor="duration_label">{copy.duration}</Label>
            <Input
              id="duration_label"
              required
              value={durationLabel}
              disabled={pending}
              className="h-11 rounded-xl"
              placeholder={computedDuration || copy.durationPlaceholder}
              onChange={(e) => {
                setDurationTouched(true);
                setDurationLabel(e.target.value);
              }}
            />
          </div>
        ) : (
          <input type="hidden" name="duration_label" value={durationLabel} />
        )}

        <div className="space-y-2">
          <Label htmlFor="contact_mobile">{copy.mobile}</Label>
          <Input
            id="contact_mobile"
            dir="ltr"
            inputMode="numeric"
            required
            value={mobile}
            disabled={pending}
            placeholder="05xxxxxxxx"
            className="h-11 rounded-xl"
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-slate-500">{copy.mobileHelp}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">{copy.location}</Label>
          <select
            id="location"
            required
            value={location}
            disabled={pending}
            className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
            onChange={(event) => setLocation(event.target.value)}
          >
            <option value="">{copy.locationPlaceholder}</option>
            {PROJECT_LOCATIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="justification">{copy.justification}</Label>
          <Textarea
            id="justification"
            required
            minLength={10}
            value={justification}
            disabled={pending}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={copy.justificationPlaceholder}
            className="min-h-24 rounded-xl border-slate-200 bg-white"
          />
          <p className="text-xs text-slate-500">{copy.justificationHelp}</p>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {tm(error)}
          </p>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={pending || overLimit}
          >
            <Send className="size-4" />
            {pending ? copy.submitting : copy.submit}
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

function DurationHint({
  text,
  warning,
}: {
  text: string | null;
  warning: boolean;
}) {
  if (!text) return null;
  return (
    <p className={cn("text-xs", warning ? "text-rose-600" : "text-slate-500")}>
      {text}
    </p>
  );
}

function StepShell({
  step,
  title,
  description,
  children,
  muted = false,
  done = false,
}: {
  step: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  muted?: boolean;
  done?: boolean;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm",
        muted ? "border-dashed border-slate-200 opacity-70" : "border-slate-200",
      )}
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            done
              ? "bg-emerald-600 text-white"
              : muted
                ? "bg-slate-100 text-slate-400"
                : "bg-[#e30613] text-white",
          )}
        >
          {done ? <Check className="size-4" /> : step}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </header>
      {children ? <div className="px-5 py-5">{children}</div> : null}
    </section>
  );
}
