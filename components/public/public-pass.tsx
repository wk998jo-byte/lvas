"use client";

import { Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export type PublicPassData = {
  id: string;
  plate: string;
  vehicle: string;
  driver: string;
  badge: string;
  startDate: string;
  endDate: string;
  usageAfter: string;
};

export function PublicPass({ pass }: { pass: PublicPassData }) {
  const payload = [
    "LVAS-PASS",
    `id=${pass.id}`,
    `plate=${pass.plate}`,
    `driver=${pass.driver}`,
    `expires=${pass.endDate}`,
  ].join("|");

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="no-print h-10 rounded-full"
        onClick={() => window.print()}
      >
        <Printer className="size-4" />
        Print pass
      </Button>

      <div
        id="authorization-pass"
        className="overflow-hidden rounded-2xl border border-[#e30613]/30 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <BrandLogo variant="compact" tone="light" />
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-slate-500 uppercase">
              Gate authorization
            </p>
            <p className="text-sm font-semibold text-[#e30613]">APPROVED</p>
          </div>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-[1fr_140px]">
          <div className="space-y-3">
            <PassField label="Driver / requester" value={pass.driver} />
            <div className="grid gap-3 sm:grid-cols-2">
              <PassField label="Badge" value={pass.badge} />
              <PassField label="Vehicle plate" value={pass.plate} />
              <PassField label="Vehicle" value={pass.vehicle} />
              <PassField label="Usage after" value={pass.usageAfter} />
              <PassField label="Valid from" value={pass.startDate} />
              <PassField label="Expires" value={pass.endDate} accent />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
            <QRCodeSVG value={payload} size={120} level="M" includeMargin />
            <p className="text-center text-[10px] text-slate-500">
              Scan at company gate
            </p>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          LVAS | Bin Quraya — after-hours light vehicle authorization. Present
          this pass with company ID.
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
