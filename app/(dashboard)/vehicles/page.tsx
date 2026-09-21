import { Car, Shield } from "lucide-react";

import { requireUser } from "@/lib/auth/guards";
import { listVehicles } from "@/lib/db/queries";
import { VehicleDirectory } from "@/components/vehicles/vehicle-directory";
import { VehiclesAdminTable } from "@/components/vehicles/vehicles-admin-table";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";

  let list;
  try {
    list = await listVehicles(!isAdmin);
  } catch (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vehicles</h1>
        <p className="text-sm text-destructive" role="alert">
          Failed to load vehicles:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const activeCount = list.filter((vehicle) => vehicle.is_active).length;
  const inactiveCount = list.length - activeCount;

  return (
    <div className="space-y-6 animate-rise">
      <div className="glass-panel relative overflow-hidden rounded-3xl p-6 md:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/45 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 right-8 size-40 rounded-full bg-[#e30613]/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#e30613] uppercase">
              {isAdmin ? (
                <Shield className="size-3.5" />
              ) : (
                <Car className="size-3.5" />
              )}
              {isAdmin ? "Fleet management" : "Fleet directory"}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Vehicles
            </h1>
            <p className="max-w-xl text-sm text-slate-500 md:text-base">
              {isAdmin
                ? "Browse, create, edit, and activate light vehicles for after-hours authorization."
                : "Browse active light vehicles available for after-hours authorization."}
            </p>
          </div>

          {isAdmin ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Total
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                  {list.length}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-emerald-600/80 uppercase">
                  Active
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
                  {activeCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  Inactive
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-700">
                  {inactiveCount}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                Active fleet
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {activeCount}
              </p>
            </div>
          )}
        </div>
      </div>

      {isAdmin ? (
        <VehiclesAdminTable vehicles={list} />
      ) : (
        <VehicleDirectory vehicles={list} />
      )}
    </div>
  );
}
