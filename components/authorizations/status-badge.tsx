import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AuthorizationStatus } from "@/types/database";

const STATUS_LABEL: Record<AuthorizationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<AuthorizationStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  expired: "border-slate-200 bg-slate-50 text-slate-600",
  cancelled: "border-slate-200 bg-slate-50 text-slate-500",
};

const DOT_CLASS: Record<AuthorizationStatus, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  expired: "bg-slate-400",
  cancelled: "bg-slate-400",
};

export function AuthorizationStatusBadge({
  status,
  className,
}: {
  status: AuthorizationStatus;
  className?: string;
}) {
  const pulse = status === "pending";

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border px-2.5 font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-75",
              DOT_CLASS[status],
            )}
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-1.5 rounded-full",
            DOT_CLASS[status],
          )}
        />
      </span>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
