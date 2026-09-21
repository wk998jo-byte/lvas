import { cn } from "@/lib/utils";

export type BreakdownItem = {
  label: string;
  value: number;
  barClass: string;
};

export function StatusBreakdown({ items }: { items: BreakdownItem[] }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const percent = total === 0 ? 0 : Math.round((item.value / total) * 100);
        return (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-slate-600">{item.label}</span>
              <span className="tabular-nums text-slate-500">
                {item.value}
                <span className="ml-1 text-xs text-slate-400">{percent}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn("h-full rounded-full", item.barClass)}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}
      {total === 0 ? (
        <p className="text-sm text-slate-400">No authorizations recorded yet.</p>
      ) : null}
    </div>
  );
}
