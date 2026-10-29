"use client";

import { useI18n } from "@/lib/i18n/client";
import {
  formatAuthorizationDate,
  type VisibleAuthorizationConflict,
} from "@/lib/authorizations/overlap";

export function ActiveAuthorizationNotice({
  conflict,
}: {
  conflict: VisibleAuthorizationConflict;
}) {
  const { t, locale } = useI18n();
  const copy = t.approvals.activeNotice;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-semibold">{copy.title}</p>
      {"restricted" in conflict ? (
        <p>{copy.restricted}</p>
      ) : (
        <>
          <p>
            {copy.authorizedTo} {conflict.authorized_to}
          </p>
          <p>
            {copy.validUntil} {formatAuthorizationDate(conflict.end_date, locale)}
          </p>
        </>
      )}
    </div>
  );
}
