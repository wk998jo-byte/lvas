"use client";

import { useRef } from "react";
import { Download, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { BrandLogo } from "@/components/brand/logo";
import { resolveRequester } from "@/lib/authorizations/requester";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AuthorizationDetailData } from "@/components/authorizations/authorization-detail";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function buildPassPayload(input: {
  id: string;
  plate: string;
  driver: string;
  expiry: string;
}) {
  return [
    "LVAS-PASS",
    `id=${input.id}`,
    `plate=${input.plate}`,
    `driver=${input.driver}`,
    `expires=${input.expiry}`,
  ].join("|");
}

export function DigitalAuthorizationPass({
  request,
}: {
  request: AuthorizationDetailData;
}) {
  const passRef = useRef<HTMLDivElement>(null);
  const vehicle = one(request.vehicles);
  const requester = resolveRequester({
    profile: request.requester,
    employee: request.employees,
    contactMobile: request.contact_mobile,
  });
  const plate = vehicle?.plate_number ?? "UNKNOWN";
  const driver = requester.name;
  const payload = buildPassPayload({
    id: request.id,
    plate,
    driver,
    expiry: request.end_date,
  });

  if (request.status !== "approved") return null;

  function printPass() {
    window.print();
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="border-b no-print">
        <CardTitle className="text-base">Digital Authorization Pass</CardTitle>
        <CardDescription>
          Printable gate pass with QR verification for security screening.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2 no-print">
          <Button type="button" onClick={printPass}>
            <Printer className="size-3.5" />
            Print pass
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.print();
            }}
          >
            <Download className="size-3.5" />
            Download / Save as PDF
          </Button>
        </div>

        <div
          id="authorization-pass"
          ref={passRef}
          className="overflow-hidden rounded-xl border border-primary/30 bg-white text-slate-900 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
            <BrandLogo variant="compact" tone="light" />
            <div className="text-right">
              <p className="text-[10px] tracking-[0.2em] text-white/60 uppercase">
                Gate authorization
              </p>
              <p className="text-sm font-semibold text-[#e30613]">APPROVED</p>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-[1fr_140px]">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  Driver / requester
                </p>
                <p className="text-base font-semibold">{driver}</p>
                {requester.department ? (
                  <p className="text-xs text-slate-500">{requester.department}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Vehicle plate
                  </p>
                  <p className="font-semibold">{plate}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Vehicle
                  </p>
                  <p className="font-semibold">
                    {vehicle
                      ? `${vehicle.make} ${vehicle.model}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Valid from
                  </p>
                  <p className="font-semibold">{request.start_date}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Expires
                  </p>
                  <p className="font-semibold text-[#C8102E]">
                    {request.end_date}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Usage after
                  </p>
                  <p className="font-semibold">
                    {typeof request.usage_after === "string"
                      ? request.usage_after.slice(0, 5)
                      : request.usage_after}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    Authorization ID
                  </p>
                  <p className="font-mono text-xs break-all">{request.id}</p>
                </div>
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
            LVAS | Bin Quraya — After-hours light vehicle authorization. Present
            this pass with company ID.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
