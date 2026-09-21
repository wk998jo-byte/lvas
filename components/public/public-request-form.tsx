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
import {
  durationExceedsLimit,
  durationLimitMessage,
  getRoleRequestLimit,
  type RoleRequestLimit,
} from "@/lib/authorizations/limits";
import { formatDurationLabel, inclusiveDayCount } from "@/lib/dates";
import { roleLabel } from "@/lib/auth/roles";
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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Latest end date allowed for the category, inclusive of the start date. */
function maxEndDate(startDate: string, limit: RoleRequestLimit | null) {
  if (!limit) return undefined;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return undefined;
  start.setUTCDate(start.getUTCDate() + limit.maxDurationDays - 1);
  return start.toISOString().slice(0, 10);
}

/** Identity carried between steps; the server re-verifies on submit. */
type VerifiedIdentity = { employee: PublicEmployee; idLast4: string };

export function PublicRequestForm({ vehicles }: PublicRequestFormProps) {
  const router = useRouter();
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
          title="Request details"
          description="Unlocks once your identity is confirmed."
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
      setError("Find and select your name first.");
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
      toast.success(`Welcome, ${result.data.full_name.split(" ")[0]}`);
    });
  }

  if (verified) {
    const limit = getRoleRequestLimit(verified.employee.role);
    return (
      <StepShell
        step="1"
        title="Identity confirmed"
        description={`${verified.employee.full_name} · badge ${verified.employee.badge}`}
        done
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="size-3.5" />
            {roleLabel(verified.employee.role)}
          </span>
          {limit ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
              <Clock3 className="size-3.5" />
              {limit.cadenceLabel}, {limit.durationLabel}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onVerified(null)}
          >
            Not you?
          </Button>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="1"
      title="Confirm who you are"
      description="Search the employee directory, then verify with the last 4 digits of your national ID."
    >
      <form className="space-y-4" onSubmit={submitVerification}>
        <div className="space-y-2">
          <Label htmlFor="employee-search">Badge number or name</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="employee-search"
              value={query}
              autoComplete="off"
              placeholder="e.g. 20451 or Mohammed Ali"
              className="h-11 rounded-xl pl-9"
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(null);
              }}
            />
            {searching && term.length >= 3 ? (
              <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-slate-400" />
            ) : null}
          </div>
          {term.length > 0 && term.length < 3 ? (
            <p className="text-xs text-slate-500">
              Type at least 3 characters.
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
                      "flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition",
                      active ? "bg-red-50" : "hover:bg-slate-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {employee.full_name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        Badge {employee.badge}
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
            No employee matches that search. Check your badge number.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-[200px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="id_last4">Last 4 digits of national ID</Label>
            <Input
              id="id_last4"
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
            {pending ? "Verifying…" : "Verify identity"}
          </Button>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {error}
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
  const { employee } = identity;
  const limit = getRoleRequestLimit(employee.role);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleOption | null>(null);
  const [startDate, setStartDate] = useState(todayIsoDate);
  const [endDate, setEndDate] = useState(todayIsoDate);
  const [durationTouched, setDurationTouched] = useState(false);
  const [durationLabel, setDurationLabel] = useState(() =>
    formatDurationLabel(todayIsoDate(), todayIsoDate()),
  );
  const [usageAfter, setUsageAfter] = useState("19:00");
  const [mobile, setMobile] = useState("");
  const [purpose, setPurpose] = useState("");

  const computedDuration = useMemo(
    () => formatDurationLabel(startDate, endDate),
    [startDate, endDate],
  );
  const selectedDays = inclusiveDayCount(startDate, endDate);
  const overLimit = limit
    ? durationExceedsLimit(startDate, endDate, limit)
    : false;

  function syncDuration(nextStart: string, nextEnd: string) {
    if (!durationTouched) {
      setDurationLabel(formatDurationLabel(nextStart, nextEnd));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vehicle) {
      setError("Select a vehicle");
      return;
    }
    if (limit && overLimit) {
      setError(durationLimitMessage(limit));
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
        usage_after: usageAfter,
        purpose,
        contact_mobile: mobile,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success("Request submitted");
      onSubmitted(result.data.token);
    });
  }

  return (
    <StepShell
      step="2"
      title="Request details"
      description="Pick the vehicle and the after-hours window you need."
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="vehicle">Vehicle</Label>
          <VehicleCombobox
            id="vehicle"
            vehicles={vehicles}
            value={vehicle}
            onValueChange={setVehicle}
            disabled={pending}
          />
          <p className="text-xs text-slate-500">
            Type a plate number, make, or model to filter{" "}
            {vehicles.length.toLocaleString()} vehicles.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="start_date">Start date</Label>
            <Input
              id="start_date"
              type="date"
              required
              value={startDate}
              min={todayIsoDate()}
              disabled={pending}
              className="h-11 rounded-xl"
              onChange={(e) => {
                setStartDate(e.target.value);
                syncDuration(e.target.value, endDate);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_date">End date</Label>
            <Input
              id="end_date"
              type="date"
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
                  ? `Your category allows ${limit.durationLabel}. Selected: ${selectedDays} days.`
                  : `Max window: ${limit.durationLabel}.`}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="duration_label">Duration</Label>
            <Input
              id="duration_label"
              required
              value={durationLabel}
              disabled={pending}
              className="h-11 rounded-xl"
              placeholder={computedDuration || "e.g. 3 days"}
              onChange={(e) => {
                setDurationTouched(true);
                setDurationLabel(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage_after">Usage after</Label>
            <Input
              id="usage_after"
              type="time"
              required
              value={usageAfter}
              disabled={pending}
              className="h-11 rounded-xl"
              onChange={(e) => setUsageAfter(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_mobile">Mobile number</Label>
          <Input
            id="contact_mobile"
            inputMode="numeric"
            required
            value={mobile}
            disabled={pending}
            placeholder="05xxxxxxxx"
            className="h-11 rounded-xl"
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-slate-500">
            Used only to reach you about this request.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">Purpose (optional)</Label>
          <Textarea
            id="purpose"
            value={purpose}
            disabled={pending}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Brief reason for the authorization"
            className="min-h-24 rounded-xl border-slate-200 bg-white"
          />
        </div>

        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="border-t border-slate-100 pt-5">
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={pending || overLimit}
          >
            <Send className="size-4" />
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </StepShell>
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
