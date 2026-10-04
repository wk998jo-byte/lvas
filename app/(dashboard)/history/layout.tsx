import { requireRole } from "@/lib/auth/guards";

export default async function HistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["admin", "logistics_approver"]);
  return children;
}
