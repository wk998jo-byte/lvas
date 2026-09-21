import {
  AlertTriangle,
  Car,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardKpis } from "@/lib/dashboard/stats";

type KpiCardsProps = {
  stats: DashboardKpis;
  pendingLabel?: string;
};

const ICON_TONES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-600",
  amber: "border-amber-200 bg-amber-50 text-amber-600",
  rose: "border-rose-200 bg-rose-50 text-rose-600",
  red: "border-red-200 bg-red-50 text-[#e30613]",
} as const;

export function KpiCards({
  stats,
  pendingLabel = "Pending approvals",
}: KpiCardsProps) {
  const items = [
    {
      key: "active",
      label: "Total active authorizations",
      value: stats.activeAuthorizations,
      description: "Approved and currently valid",
      icon: CheckCircle2,
      tone: "green" as const,
      pulse: false,
    },
    {
      key: "pending",
      label: pendingLabel,
      value: stats.pendingApprovals,
      description: "Awaiting decision",
      icon: ClipboardList,
      tone: "amber" as const,
      pulse: stats.pendingApprovals > 0,
    },
    {
      key: "expiring",
      label: "Expiring within 7 days",
      value: stats.expiringWithin7Days,
      description: "Needs renewal attention",
      icon: AlertTriangle,
      tone: "rose" as const,
      pulse: false,
    },
    {
      key: "fleet",
      label: "Total fleet vehicles",
      value: stats.fleetVehicles,
      description: "Active in directory",
      icon: Car,
      tone: "red" as const,
      pulse: false,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} className="relative overflow-hidden">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e30613]/30 to-transparent"
            />
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
              <div className="space-y-1">
                <CardDescription className="text-[11px] font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  {item.label}
                </CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl font-semibold tabular-nums text-slate-900">
                  {item.value}
                  {item.pulse ? (
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                    </span>
                  ) : null}
                </CardTitle>
              </div>
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-xl border",
                  ICON_TONES[item.tone],
                )}
              >
                <Icon className="size-5" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-500">{item.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
