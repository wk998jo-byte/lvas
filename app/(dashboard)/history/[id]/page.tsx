import { notFound } from "next/navigation";
import { buildGateVerificationUrl } from "@/lib/authorizations/gate-url";

import { requireRole } from "@/lib/auth/guards";
import { isEffectivelyApproved } from "@/lib/authorizations/effective-status";
import { findApprovedOverlappingAuthorization, getAuthorizationDetail, listLocationsForApprover } from "@/lib/db/queries";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { EndAuthorizationAction } from "@/components/approvals/end-authorization-action";
import { canReviewApproval } from "@/lib/approvals/presentation";
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
  const profile = await requireRole(["admin", "logistics_approver"]);
  const { id } = await params;

  let request;
  let conflict;
  try {
    const locations = profile.role === "logistics_approver"
      ? await listLocationsForApprover(profile.id)
      : undefined;
    request = await getAuthorizationDetail(id, locations);
    if (request?.status === "pending") {
      const overlapInput = {
        vehicleId: request.vehicle_id,
        startDate: request.start_date,
        endDate: request.end_date,
        excludeId: request.id,
      };
      const overlap = await findApprovedOverlappingAuthorization(overlapInput);
      // A global availability signal is safe; another location's identity,
      // dates and request ID are not.
      conflict = overlap && locations !== undefined
        ? await findApprovedOverlappingAuthorization({ ...overlapInput, locations })
          ?? { restricted: true as const }
        : overlap;
    }
  } catch {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request</h1>
        <p className="text-sm text-destructive" role="alert">
          Unable to load request. Please try again later.
        </p>
      </div>
    );
  }

  if (!request) notFound();

  return (
    <AuthorizationDetailView
      request={request as AuthorizationDetailData}
      verificationUrl={buildGateVerificationUrl(request.public_token)}
      breadcrumb={{ href: "/history", label: "Requests history" }}
      title="Authorization details"
      viewerRole={profile.role}
      actions={
        canReviewApproval(profile.role, request) ? (
          <ApprovalActions
            authorizationId={request.id}
            conflict={conflict}
          />
        ) : profile.role === "admin" &&
          isEffectivelyApproved(request.status, request.end_date) ? (
          <EndAuthorizationAction authorizationId={request.id} />
        ) : null
      }
    />
  );
}
