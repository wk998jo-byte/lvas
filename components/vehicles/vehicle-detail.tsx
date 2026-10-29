import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Car,
  Clock3,
  FileText,
  Hash,
  Palette,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { cn } from "@/lib/utils";
import { localizedPlateLabel, vehicleIdentityLabel } from "@/components/vehicles/plate-label";
import type { Vehicle } from "@/types/database";

type VehicleDetailViewProps = {
  vehicle: Vehicle;
  locale?: Locale;
};

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
        "rounded-2xl border p-4 transition-colors",
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

function formatDate(value: string, locale: Locale) {
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function VehicleDetailView({
  vehicle,
  locale = DEFAULT_LOCALE,
}: VehicleDetailViewProps) {
  const t = getDictionary(locale).vehicles;
  const copy = t.detail;
  return (
    <div className="space-y-6 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          render={<Link href="/vehicles" />}
        >
          <ArrowLeft className="size-3.5 rtl:rotate-180" />
          {copy.backToFleet}
        </Button>
        {vehicle.is_active ? (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            render={<Link href="/request" target="_blank" />}
          >
            {copy.publicRequestForm}
          </Button>
        ) : null}
      </div>

      <section className="glass-panel-strong relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/55 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 end-0 size-56 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white shadow-sm">
              <Car className="size-7 text-[#e30613]" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    vehicle.is_active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {vehicle.is_active ? copy.activeInFleet : copy.inactive}
                </Badge>
                <span className="text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">
                  {copy.lightVehicle}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                {vehicle.door_number ? t.identity.door(vehicle.door_number) : copy.vehicleFallback}
              </h1>
              <p className="text-base text-slate-600 md:text-lg">
                {localizedPlateLabel(vehicle, locale)} ·{" "}
                {vehicle.make} {vehicle.model}
                {vehicle.year ? ` · ${vehicle.year}` : ""}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
              {copy.directoryId}
            </p>
            <p className="mt-1 font-mono text-xs text-slate-700">{vehicle.id}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={Hash}
          label={copy.identifiers}
          value={vehicleIdentityLabel(vehicle, locale)}
          accent
        />
        <InfoTile
          icon={Car}
          label={copy.makeModel}
          value={`${vehicle.make} ${vehicle.model}`}
        />
        <InfoTile
          icon={Calendar}
          label={copy.modelYear}
          value={vehicle.year?.toString() ?? copy.notSet}
        />
        <InfoTile
          icon={Palette}
          label={copy.color}
          value={vehicle.color?.trim() || copy.notSet}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[#e30613]" />
              <CardTitle>{copy.notes}</CardTitle>
            </div>
            <CardDescription>{copy.notesDescription}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {vehicle.notes?.trim() ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                {vehicle.notes}
              </p>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                {copy.noNotes}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[#e30613]" />
              <CardTitle>{copy.recordStatus}</CardTitle>
            </div>
            <CardDescription>{copy.recordStatusDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock3 className="size-4 text-slate-400" />
                {copy.added}
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(vehicle.created_at, locale)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/70 px-3 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock3 className="size-4 text-slate-400" />
                {copy.lastUpdated}
              </div>
              <span className="text-sm font-medium text-slate-900">
                {formatDate(vehicle.updated_at, locale)}
              </span>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50/70 px-3 py-3 text-sm text-slate-700">
              {vehicle.is_active
                ? copy.availableNote
                : copy.inactiveNote}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
