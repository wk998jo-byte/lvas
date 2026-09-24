import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { isEffectivelyApproved } from "@/lib/authorizations/effective-status";
import { findApprovedOverlappingAuthorization, getAuthorizationDetail } from "@/lib/db/queries";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { EndAuthorizationAction } from "@/components/approvals/end-authorization-action";
import {
  AuthorizationDetailView,
  type AuthorizationDetailData,
} from "@/components/authorizations/authorization-detail";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  let request;
  try {
    request = await getAuthorizationDetail(id);
  } catch (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request</h1>
        <p className="text-sm text-destructive" role="alert">
          Failed to load request:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!request) notFound();

  const conflict =
    request.status === "pending"
      ? await findApprovedOverlappingAuthorization({
          vehicleId: request.vehicle_id,
          startDate: request.start_date,
          endDate: request.end_date,
          excludeId: request.id,
        })
      : null;

  return (
    <AuthorizationDetailView
      request={request as AuthorizationDetailData}
      breadcrumb={{ href: "/history", label: "Requests history" }}
      title="Authorization details"
      actions={
        request.status === "pending" ? (
          <ApprovalActions
            authorizationId={request.id}
            conflict={conflict}
          />
        ) : isEffectivelyApproved(request.status, request.end_date) ? (
          <EndAuthorizationAction authorizationId={request.id} />
        ) : null
      }
    />
  );
}
