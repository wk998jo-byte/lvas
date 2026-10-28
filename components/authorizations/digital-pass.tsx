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
import { isEffectivelyApproved } from "@/lib/authorizations/effective-status";
import { isExtendedUsageAfter } from "@/lib/business-date";
import { useI18n } from "@/lib/i18n/client";
import { plateLabel } from "@/components/vehicles/plate-label";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function DigitalAuthorizationPass({
  request,
  verificationUrl,
}: {
  request: AuthorizationDetailData;
  verificationUrl: string | null;
}) {
  const { t } = useI18n();
  const copy = t.approvals.pass;
  const passRef = useRef<HTMLDivElement>(null);
  const vehicle = one(request.vehicles);
  const requester = resolveRequester({
    profile: request.requester,
    employee: request.employees,
    contactMobile: request.contact_mobile,
  });
  const plate = vehicle ? plateLabel(vehicle) : copy.plateUnavailable;
  const driver = requester.name;

  if (!isEffectivelyApproved(request.status, request.end_date)) return null;

  function printPass() {
    window.print();
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="border-b no-print">
        <CardTitle className="text-base">{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2 no-print">
          <Button type="button" onClick={printPass}>
            <Printer className="size-3.5" />
            {copy.print}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.print();
            }}
          >
            <Download className="size-3.5" />
            {copy.download}
          </Button>
        </div>

        <div
          id="authorization-pass"
          ref={passRef}
          className="overflow-hidden rounded-xl border border-primary/30 bg-white text-slate-900 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
            <BrandLogo variant="compact" tone="light" />
            <div className="text-end">
              <p className="text-[10px] tracking-[0.2em] text-white/60 uppercase">
                {copy.gateAuthorization}
              </p>
              <p className="text-sm font-semibold text-[#e30613]">{copy.approved}</p>
            </div>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-[1fr_140px]">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  {copy.driver}
                </p>
                <p className="text-base font-semibold">{driver}</p>
                {requester.department ? (
                  <p className="text-xs text-slate-500">{requester.department}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.doorNumber}
                  </p>
                  <p className="font-semibold">{vehicle?.door_number ?? copy.unavailable}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.vehiclePlate}
                  </p>
                  <p className="font-semibold">{plate}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.vehicle}
                  </p>
                  <p className="font-semibold">
                    {vehicle
                      ? `${vehicle.make} ${vehicle.model}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.validFrom}
                  </p>
                  <p className="font-semibold" dir="ltr">{request.start_date}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.expires}
                  </p>
                  <p className="font-semibold text-[#C8102E]" dir="ltr">
                    {request.end_date}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {t.common.extendedTime.usageAfter}
                  </p>
                  <p className="font-semibold">
                    {typeof request.usage_after === "string"
                      ? request.usage_after.slice(0, 5)
                      : request.usage_after}
                    {isExtendedUsageAfter(request.usage_after)
                      ? ` · ${t.common.extendedTime.badge}`
                      : null}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {copy.authorizationId}
                  </p>
                  <p className="font-mono text-xs break-all">{request.id}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
              {verificationUrl ? (
                <QRCodeSVG value={verificationUrl} size={120} level="M" includeMargin />
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
      </CardContent>
    </Card>
  );
}
