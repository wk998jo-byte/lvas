import {
  formatAuthorizationDate,
  type VisibleAuthorizationConflict,
} from "@/lib/authorizations/overlap";

export function ActiveAuthorizationNotice({
  conflict,
}: {
  conflict: VisibleAuthorizationConflict;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <p className="font-semibold">Active authorization</p>
      {"restricted" in conflict ? (
        <p>This vehicle is unavailable for the requested dates.</p>
      ) : (
        <>
          <p>Authorized to: {conflict.authorized_to}</p>
          <p>Valid until: {formatAuthorizationDate(conflict.end_date)}</p>
        </>
      )}
    </div>
  );
}
