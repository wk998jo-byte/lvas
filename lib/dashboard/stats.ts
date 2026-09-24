import { addCalendarDays, saudiTodayIsoDate } from "@/lib/business-date";
import {
  countActiveVehicles,
  countApprovedActive,
  countExpiringWithin,
  countPendingAuthorizations,
} from "@/lib/db/queries";

export type DashboardKpis = {
  activeAuthorizations: number;
  pendingApprovals: number;
  expiringWithin7Days: number;
  fleetVehicles: number;
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const today = saudiTodayIsoDate();
  const in7Days = addCalendarDays(today, 7);

  const [active, pending, expiring, fleet] = await Promise.all([
    countApprovedActive(today),
    countPendingAuthorizations(),
    countExpiringWithin(today, in7Days),
    countActiveVehicles(),
  ]);

  return {
    activeAuthorizations: active,
    pendingApprovals: pending,
    expiringWithin7Days: expiring,
    fleetVehicles: fleet,
  };
}
