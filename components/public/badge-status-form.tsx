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

export function BadgeStatusForm() {
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
            <Label htmlFor="badge">Badge number</Label>
            <Input
              id="badge"
              required
              value={badge}
              autoComplete="off"
              placeholder="e.g. 20451"
              className="h-11 rounded-xl"
              onChange={(event) => setBadge(event.target.value.trim())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="id_last4">Last 4 of national ID</Label>
            <Input
              id="id_last4"
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
            {pending ? "Looking up…" : "Show my requests"}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          The last 4 digits confirm it is your badge, so someone else cannot
          open your requests.
        </p>
        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </form>

      {requests ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {name} · {requests.length} request{requests.length === 1 ? "" : "s"}
          </h2>
          {requests.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
              No requests are linked to this badge yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {requests.map((request) => {
                const status = effectiveAuthorizationStatus(
                  request.status,
                  request.endDate,
                );
                return (
                  <li key={request.token}>
                    <Link
                      href={`/track/${request.token}`}
                      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#e30613]/30"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {request.plate ?? "Vehicle"}
                          {request.vehicle ? (
                            <span className="ml-2 font-normal text-slate-500">
                              {request.vehicle}
                            </span>
                          ) : null}
                        </p>
                        <AuthorizationStatusBadge
                          status={status}
                          label={approvalStatusLabel({
                            status,
                            approval_stage: request.approvalStage,
                          })}
                        />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {request.startDate} → {request.endDate} ·{" "}
                        {request.durationLabel}
                        {request.location ? ` · ${request.location}` : ""} · Ref{" "}
                        {request.reference}
                      </p>
                      {request.rejectionReason ? (
                        <p className="mt-2 text-xs text-rose-700">
                          {request.rejectionReason}
                        </p>
                      ) : null}
                      <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#e30613]">
                        Open request
                        <ArrowUpRight className="size-3.5" />
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
