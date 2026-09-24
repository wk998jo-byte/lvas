import { History } from "lucide-react";

import { isEffectivelyApproved } from "@/lib/authorizations/effective-status";
import { requireRole } from "@/lib/auth/guards";
import { listHistoryAuthorizations } from "@/lib/db/queries";
import { ApprovalsTable } from "@/components/approvals/approvals-table";

export const dynamic = "force-dynamic";

export default async function RequestsHistoryPage() {
  await requireRole("admin");

  let requests;
  try {
    requests = await listHistoryAuthorizations(300);
  } catch (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Requests history
        </h1>
        <p className="text-sm text-destructive" role="alert">
          Failed to load history:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const approved = requests.filter((item) =>
    isEffectivelyApproved(item.status, item.end_date),
  ).length;

  return (
    <div className="space-y-6 animate-rise">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/45 to-transparent"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#e30613] uppercase">
              <History className="size-3.5" />
              Decided requests
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Requests history
            </h1>
            <p className="max-w-xl text-sm text-slate-500 md:text-base">
              Every request that has been approved, rejected, cancelled, or has
              expired. Pending requests stay on the dashboard.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
              Approved
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {approved}
            </p>
          </div>
        </div>
      </div>

      <ApprovalsTable requests={requests} mode="history" />
    </div>
  );
}
