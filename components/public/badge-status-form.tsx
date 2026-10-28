"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

import {
  lookupRequestsByBadge,
  type BadgeRequestSummary,
} from "@/actions/public-requests";
import { AuthorizationStatusBadge } from "@/components/authorizations/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { approvalStatusLabel } from "@/lib/approvals/presentation";
import { effectiveAuthorizationStatus } from "@/lib/authorizations/effective-status";
import { isExtendedUsageAfter } from "@/lib/business-date";
import { useI18n } from "@/lib/i18n/client";
import { plateLabel } from "@/components/vehicles/plate-label";

export function BadgeStatusForm() {
  const { t, locale, tm } = useI18n();
  const copy = t.public.badgeForm;
  const vehicleCopy = t.public.vehicle;
  const [badge, setBadge] = useState("");
  const [idLast4, setIdLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [requests, setRequests] = useState<BadgeRequestSummary[] | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupRequestsByBadge({
        badge,
        id_last4: idLast4,
      });
      if (!result.ok) {
        setName(null);
        setRequests(null);
        setError(result.error);
        return;
      }
      setName(result.data.fullName);
      setRequests(result.data.requests);
    });
  }

  return (
    <div className="space-y-5">
      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={onSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="badge">{copy.badgeLabel}</Label>
            <Input
              id="badge"
              dir="ltr"
              required
              value={badge}
              autoComplete="off"
              placeholder={copy.badgePlaceholder}
              className="h-11 rounded-xl"
              onChange={(event) => setBadge(event.target.value.trim())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_last4">{copy.idLast4Label}</Label>
            <Input
              id="id_last4"
              dir="ltr"
              inputMode="numeric"
              maxLength={4}
              required
              value={idLast4}
              placeholder="••••"
              className="h-11 rounded-xl tracking-[0.4em]"
              onChange={(event) =>
                setIdLast4(event.target.value.replace(/\D/g, "").slice(0, 4))
              }
            />
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full"
            disabled={pending || idLast4.length !== 4}
          >
            <Search className="size-4" />
            {pending ? copy.lookingUp : copy.showRequests}
          </Button>
        </div>
        <p className="text-xs text-slate-500">{copy.privacyHelp}</p>
        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {tm(error)}
          </p>
        ) : null}
      </form>

      {requests ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {name} · {copy.requestCount(requests.length)}
          </h2>
          {requests.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              {copy.empty}
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => {
                const status = effectiveAuthorizationStatus(
                  request.status,
                  request.endDate,
                );
                const plateValue = plateLabel({
                  plate_number: request.plate,
                  door_number: request.doorNumber,
                });
                const plate =
                  plateValue === "Plate unavailable"
                    ? vehicleCopy.plateUnavailable
                    : plateValue;
                return (
                  <li key={request.token}>
                    <Link
                      href={`/track/${request.token}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#e30613]/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {request.doorNumber
                            ? `${vehicleCopy.door(request.doorNumber)} · ${plate}`
                            : `${vehicleCopy.doorUnavailable} · ${plate}`}
                          {request.vehicle ? (
                            <span className="ms-2 font-normal text-slate-500">
                              {request.vehicle}
                            </span>
                          ) : null}
                        </p>
                        <AuthorizationStatusBadge
                          status={status}
                          label={approvalStatusLabel(
                            {
                              status,
                              approval_stage: request.approvalStage,
                            },
                            locale,
                          )}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.startDate} {t.common.dateRangeSeparator}{" "}
                        {request.endDate} · {request.durationLabel}
                        {request.location ? ` · ${request.location}` : ""} ·{" "}
                        {copy.ref} {request.reference}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        {t.common.extendedTime.usageAfter} {request.usageAfter}
                        {isExtendedUsageAfter(request.usageAfter) ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            {t.common.extendedTime.badge}
                          </span>
                        ) : null}
                      </p>
                      {request.rejectionReason ? (
                        <p className="mt-2 text-xs text-rose-700">
                          {request.rejectionReason}
                        </p>
                      ) : null}
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#e30613]">
                        {copy.openRequest}
                        <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
