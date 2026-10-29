"use client";

import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { plateLabel } from "@/components/vehicles/plate-label";
import { isExtendedUsageAfter } from "@/lib/business-date";
import { useI18n } from "@/lib/i18n/client";

export type PublicPassData = {
  id: string;
  doorNumber: string | null;
  plate: string | null;
  vehicle: string;
  driver: string;
  badge: string;
  startDate: string;
  endDate: string;
  usageAfter: string;
  verificationUrl: string | null;
};

export function PublicPass({ pass }: { pass: PublicPassData }) {
  const { t } = useI18n();
  const copy = t.public.pass;
  const plate = plateLabel({
    plate_number: pass.plate,
    door_number: pass.doorNumber,
  });
  const usageAfter = isExtendedUsageAfter(pass.usageAfter)
    ? `${pass.usageAfter} · ${t.common.extendedTime.badge}`
    : pass.usageAfter;
  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="no-print h-10 rounded-full"
        onClick={() => window.print()}
      >
        <Printer className="size-4" />
        {copy.print}
      </Button>

      <div
        id="authorization-pass"
        className="overflow-hidden rounded-2xl border border-[#e30613]/30 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <BrandLogo variant="compact" tone="light" />
          <div className="text-end">
            <p className="text-[10px] tracking-[0.2em] text-slate-500 uppercase">
              {copy.gateAuthorization}
            </p>
            <p className="text-sm font-semibold text-[#e30613]">{copy.approved}</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1fr_140px]">
          <div className="space-y-3">
            <PassField label={copy.driver} value={pass.driver} />
            <div className="grid gap-3 sm:grid-cols-2">
              <PassField label={copy.badge} value={pass.badge} />
              <PassField
                label={copy.doorNumber}
                value={pass.doorNumber ?? t.public.vehicle.unavailable}
              />
              <PassField
                label={copy.vehiclePlate}
                value={plate === "Plate unavailable" ? t.public.vehicle.plateUnavailable : plate}
              />
              <PassField label={copy.vehicle} value={pass.vehicle} />
              <PassField label={t.common.extendedTime.usageAfter} value={usageAfter} />
              <PassField label={copy.validFrom} value={pass.startDate} />
              <PassField label={copy.expires} value={pass.endDate} accent />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            {pass.verificationUrl ? (
              <QRCodeSVG value={pass.verificationUrl} size={120} level="M" includeMargin />
            ) : (
              <p role="alert" className="text-center text-xs font-semibold text-red-700">
                {copy.qrUnavailable}
              </p>
            )}
            <p className="text-center text-[10px] text-slate-500">
              {copy.scanHint}
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          {copy.footer}
        </div>
      </div>
    </div>
  );
}

function PassField({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p
        className={
          accent
            ? "font-semibold text-[#C8102E]"
            : "font-semibold text-slate-900"
        }
      >
        {value}
      </p>
    </div>
  );
}
