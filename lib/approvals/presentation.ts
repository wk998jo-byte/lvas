import type { AuthorizationStatus, UserRole } from "@/types/database";

type ApprovalState = { status: AuthorizationStatus; approval_stage: number };

export function canReviewApproval(role: UserRole, request: ApprovalState): boolean {
  return request.status === "pending" &&
    ((role === "logistics_approver" && request.approval_stage === 1) ||
      (role === "admin" && request.approval_stage === 2));
}

export function approvalStatusLabel(request: ApprovalState): string {
  if (request.status === "pending") {
    return request.approval_stage === 1
      ? "Waiting for Logistics approval"
      : "Logistics approved — waiting for final approval";
  }
  if (request.status === "rejected") {
    return request.approval_stage === 1
      ? "Rejected by Logistics"
      : "Rejected by Final Approver";
  }
  return {
    approved: "Approved",
    expired: "Expired",
    cancelled: "Cancelled",
  }[request.status];
}

export function approvalDetailMessage(role: UserRole, request: ApprovalState): string {
  if (role === "admin" && request.status === "pending" && request.approval_stage === 2) {
    return "Logistics approved — awaiting final decision";
  }
  return approvalStatusLabel(request);
}

export function decisionActorLabel(request: ApprovalState): string {
  return request.status === "rejected"
    ? approvalStatusLabel(request)
    : request.status === "pending" ? "Assigned final approver" : "Final approver";
}

export function approvalSuccessMessage(request: ApprovalState): string {
  return request.status === "pending" && request.approval_stage === 2
    ? "Logistics approval recorded. Request sent for final approval."
    : "Authorization approved";
}

export function formatDecisionTime(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)} (Saudi time)`;
}
