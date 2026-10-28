import { DEFAULT_LOCALE, intlLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { AuthorizationStatus, UserRole } from "@/types/database";

type ApprovalState = {
  status: AuthorizationStatus;
  approval_stage: number;
  approver_id?: string | null;
};

export function canReviewApproval(
  role: UserRole,
  request: ApprovalState,
  viewerId?: string,
): boolean {
  if (request.status !== "pending") return false;
  if (role === "logistics_approver" && request.approval_stage === 1) return true;
  return (
    role === "admin" &&
    request.approval_stage === 2 &&
    Boolean(viewerId) &&
    request.approver_id === viewerId
  );
}

export function approvalStatusLabel(
  request: ApprovalState,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { common } = getDictionary(locale);
  if (request.status === "pending") {
    return request.approval_stage === 1
      ? common.approval.waitingLogistics
      : common.approval.waitingFinal;
  }
  if (request.status === "rejected") {
    return request.approval_stage === 1
      ? common.approval.rejectedByLogistics
      : common.approval.rejectedByFinal;
  }
  return common.status[request.status];
}

export function approvalDetailMessage(
  role: UserRole,
  request: ApprovalState,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (role === "admin" && request.status === "pending" && request.approval_stage === 2) {
    return getDictionary(locale).common.approval.awaitingFinalDecision;
  }
  return approvalStatusLabel(request, locale);
}

export function decisionActorLabel(
  request: ApprovalState,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { common } = getDictionary(locale);
  return request.status === "rejected"
    ? approvalStatusLabel(request, locale)
    : request.status === "pending"
      ? common.approval.assignedFinalApprover
      : common.approval.finalApprover;
}

export function approvalSuccessMessage(
  request: ApprovalState,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { common } = getDictionary(locale);
  return request.status === "pending" && request.approval_stage === 2
    ? common.approval.logisticsRecorded
    : common.approval.authorizationApproved;
}

export function formatDecisionTime(
  value: string | null | undefined,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { common } = getDictionary(locale);
  if (!value) return common.notRecorded;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return common.notRecorded;
  return `${new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)} (${common.saudiTime})`;
}
