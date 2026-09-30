import { requireRole } from "@/lib/auth/guards";
import {
  countPendingForReview,
  listLocationsForApprover,
} from "@/lib/db/queries";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireRole(["admin", "logistics_approver"]);
  const pendingCount =
    profile.role === "logistics_approver"
      ? await countPendingForReview({
          stage: 1,
          locations: await listLocationsForApprover(profile.id),
        })
      : await countPendingForReview({ stage: 2 });

  return (
    <AppShell profile={profile} pendingCount={pendingCount}>
      {children}
    </AppShell>
  );
}
