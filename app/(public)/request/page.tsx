import type { Metadata } from "next";
import { Car } from "lucide-react";

import { PublicRequestForm } from "@/components/public/public-request-form";
import { ROLE_REQUEST_LIMITS } from "@/lib/authorizations/limits";
import { roleLabel } from "@/lib/auth/roles";
import { listActiveVehicles } from "@/lib/db/queries";
import type { UserRole } from "@/types/database";

export const metadata: Metadata = {
  title: "Request vehicle authorization",
  description:
    "Submit an after-hours light vehicle authorization request — no account needed.",
};

export const dynamic = "force-dynamic";

const CATEGORY_ORDER: UserRole[] = [
  "manager_requester",
  "supervisor_requester",
  "other_employee",
];

export default async function PublicRequestPage() {
  const vehicles = await listActiveVehicles();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#e30613] uppercase">
          <Car className="size-3.5" />
          Vehicle authorization
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          Request after-hours vehicle use
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          No account needed. Confirm your identity with your badge number, pick a
          vehicle and dates, and the request goes straight to the fleet admin.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
          How often you can request
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-3">
          {CATEGORY_ORDER.map((role) => {
            const limit = ROLE_REQUEST_LIMITS[role];
            if (!limit) return null;
            return (
              <li
                key={role}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {roleLabel(role)}
                </p>
                <p className="text-xs text-slate-600">
                  {limit.cadenceLabel} · {limit.durationLabel}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <PublicRequestForm vehicles={vehicles} />
    </div>
  );
}
