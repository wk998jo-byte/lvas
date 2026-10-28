"use client";

import {
  useEffect,
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
  Loader2,
  Search,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  lookupEmployees,
  submitPublicRequest,
  verifyEmployee,
  type PublicEmployee,
} from "@/actions/public-requests";
import { PROJECT_LOCATIONS } from "@/lib/approvals/logistics-team";
import {
  durationExceedsLimit,
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

type PublicRequestFormProps = {
  vehicles: VehicleOption[];
};

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
type VerifiedIdentity = { employee: PublicEmployee; idLast4: string };

export function PublicRequestForm({ vehicles }: PublicRequestFormProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [verified, setVerified] = useState<VerifiedIdentity | null>(null);

  return (
    <div className="space-y-4">
      <IdentityStep verified={verified} onVerified={setVerified} />
      {verified ? (
        <DetailsStep
          identity={verified}
          vehicles={vehicles}
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicEmployee[]>([]);
  const [selected, setSelected] = useState<PublicEmployee | null>(null);
  const [idLast4, setIdLast4] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const term = query.trim();
  // Stale matches stay in state but are hidden until the term is searchable.
  const visibleResults = term.length >= 3 ? results : [];

  useEffect(() => {
    if (verified) return;
    const searchTerm = query.trim();
    if (searchTerm.length < 3) return;

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await lookupEmployees({ query: searchTerm });
      if (!active) return;
      setSearching(false);
      if (result.ok) setResults(result.data);
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, verified]);

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setError(copy.findFirst);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await verifyEmployee({
        employee_id: selected.id,
        id_last4: idLast4,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onVerified({ employee: result.data, idLast4 });
      toast.success(copy.welcome(result.data.full_name.split(" ")[0]));
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
        <div className="space-y-2">
          <Label htmlFor="employee-search">{copy.searchLabel}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="employee-search"
              value={query}
              autoComplete="off"
              placeholder={copy.searchPlaceholder}
              className="h-11 rounded-xl ps-9"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
            />
            {searching && term.length >= 3 ? (
              <Loader2 className="absolute top-1/2 end-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : null}
          </div>
          {term.length > 0 && term.length < 3 ? (
            <p className="text-xs text-slate-500">
              {copy.minChars}
            </p>
          ) : null}
        </div>

        {visibleResults.length > 0 ? (
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {visibleResults.map((employee) => {
              const active = selected?.id === employee.id;
              return (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(employee)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition",
                      active ? "bg-red-50" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {employee.full_name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {copy.resultBadge(employee.badge)}
                        {employee.department ? ` · ${employee.department}` : ""}
                      </span>
                    </span>
                    {active ? (
                      <Check className="size-4 shrink-0 text-[#e30613]" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {term.length >= 3 && !searching && visibleResults.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {copy.noMatches}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[200px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="id_last4">{copy.idLast4Label}</Label>
            <Input
              id="id_last4"
              dir="ltr"
              inputMode="numeric"
              maxLength={4}
              value={idLast4}
              disabled={!selected || pending}
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
            disabled={!selected || idLast4.length !== 4 || pending}
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
  const [durationMode, setDurationMode] = useState<"one_day" | "custom">(
    "one_day",
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
  const [extendedTime, setExtendedTime] = useState<boolean | null>(null);

  const computedDuration = useMemo(
    () => formatDurationLabel(startDate, endDate),
    [startDate, endDate],
  );
  const selectedDays = inclusiveDayCount(startDate, endDate);
  const overLimit = limit
    ? durationExceedsLimit(startDate, endDate, limit)
    : false;

  function applyOneDay(nextStart = saudiTodayIsoDate()) {
    setDurationMode("one_day");
    setStartDate(nextStart);
    setEndDate(nextStart);
    setDurationTouched(false);
    setDurationLabel(formatDurationLabel(nextStart, nextStart));
  }

  function applyCustom() {
    setDurationMode("custom");
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
    if (limit && overLimit) {
      setError(copy.durationLimit(limitText?.duration ?? limit.durationLabel));
      return;
    }
    if (extendedTime === null) {
      setError(t.common.extendedTime.chooseError);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await submitPublicRequest({
        employee_id: employee.id,
        id_last4: identity.idLast4,
        vehicle_id: vehicle.id,
        start_date: startDate,
        end_date: endDate,
        duration_label: durationLabel || computedDuration,
        purpose: justification,
        location,
        justification,
        contact_mobile: mobile,
        extended_time: extendedTime,
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

        {useDurationPresets ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>{copy.duration}</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applyOneDay(startDate)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    durationMode === "one_day"
                      ? "border-[#e30613]/30 bg-[#e30613] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {copy.oneDay}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={applyCustom}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    durationMode === "custom"
                      ? "border-[#e30613]/30 bg-[#e30613] text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {copy.custom}
                </button>
              </div>
              <p className="text-xs text-slate-500">{copy.presetHelp}</p>
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
                    const capped = maxEndDate(next, limit);
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
                  max={maxEndDate(startDate, limit)}
                  disabled={pending || durationMode === "one_day"}
                  className="h-11 rounded-xl"
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    syncDuration(startDate, e.target.value);
                  }}
                />
                <p
                  className={cn(
                    "text-xs",
                    overLimit ? "text-rose-600" : "text-slate-500",
                  )}
                >
                  {durationMode === "one_day"
                    ? copy.singleDay
                    : overLimit
                      ? copy.overMonth(selectedDays)
                      : copy.selectedDays(selectedDays)}
                </p>
              </div>
            </div>
          </div>
        ) : (
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
                  setStartDate(e.target.value);
                  syncDuration(e.target.value, endDate);
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
                max={maxEndDate(startDate, limit)}
                disabled={pending}
                className="h-11 rounded-xl"
                onChange={(e) => {
                  setEndDate(e.target.value);
                  syncDuration(startDate, e.target.value);
                }}
              />
              {limit ? (
                <p
                  className={cn(
                    "text-xs",
                    overLimit ? "text-rose-600" : "text-slate-500",
                  )}
                >
                  {overLimit
                    ? copy.categoryOver(limitText?.duration ?? limit.durationLabel, selectedDays)
                    : copy.maxWindow(limitText?.duration ?? limit.durationLabel)}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {!useDurationPresets ? (
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

        <ExtendedTimeField
          value={extendedTime}
          onChange={setExtendedTime}
          disabled={pending}
        />

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

function ExtendedTimeField({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  const { t } = useI18n();
  const copy = t.common.extendedTime;
  const options = [
    { value: false, label: copy.noLabel },
    { value: true, label: copy.yesLabel },
  ];

  return (
    <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <legend className="sr-only">{copy.question}</legend>
      <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800" aria-hidden>
        <Clock3 className="size-3.5" />
        {copy.question}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.question}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition",
              value === option.value
                ? "border-[#e30613]/30 bg-[#e30613] text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{copy.help}</p>
      {value !== null ? (
        <p className="text-sm text-slate-600">
          {value ? copy.extendedWindow : copy.standardWindow}
        </p>
      ) : null}
    </fieldset>
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
