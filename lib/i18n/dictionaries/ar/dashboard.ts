import type { DashboardDictionary } from "@/lib/i18n/dictionaries/en/dashboard";
import type { Translation } from "@/lib/i18n/types";

/** Arabic counted noun: 1 and 2 use their own words, 3–10 the plural, 11+ the singular accusative. */
function count(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const rest = n % 100;
  return `${n} ${n === 0 || (rest >= 3 && rest <= 10) ? few : many}`;
}

const requests = (n: number) => count(n, "طلب واحد", "طلبان", "طلبات", "طلبًا");

export const dashboardAr: Translation<DashboardDictionary> = {
  home: {
    badgeLogistics: "اعتماد اللوجستيات",
    badgeAdmin: "لوحة تحكم مسؤول النظام",
    welcomeBack: "مرحبًا بعودتك، ",
    nameFallback: "زميلنا",
    introLogistics:
      "هذه الطلبات بانتظار الاعتماد الأول في مواقع مشاريعك. بعد اعتمادك، تنتقل إلى المعتمد النهائي.",
    introAdmin: "هذه الطلبات حاصلة على اعتماد اللوجستيات وبانتظار قرارك النهائي.",
    historyButton: "سجل الطلبات",
    publicFormButton: "نموذج الطلب العام",
    pendingKpiLabel: "بانتظار القرار",
    queueTitle: "طلبات بانتظار القرار",
    queuePending: " قيد الانتظار",
    queueHintLogistics: " · اعتمد هنا، ثم ينتقل الطلب إلى الاعتماد النهائي · ",
    queueHintAdmin: " · تنتقل الطلبات المحسومة إلى ",
    queueHistoryLink: "سجل الطلبات",
    waitingTitle: "بانتظار الاعتماد النهائي",
    waitingCount: (n: number) => `${requests(n)} · للعرض فقط`,
    waitingEmpty: "لا توجد طلبات بانتظار الاعتماد النهائي في المواقع المسندة إليك.",
    requesterFallback: "مقدّم الطلب",
    locationFallback: "الموقع المسند",
    logisticsApprovedBy: (name: string) => ` · اعتماد اللوجستيات: ${name}`,
    expiringTitle: "تنتهي خلال 7 أيام",
    expiringDescription: "تصاريح معتمدة تحتاج إلى متابعة التجديد",
    expiringMeta: (n: number) => `${n} قريبًا`,
    openHistory: "فتح السجل",
    expiringEmpty: "لا تنتهي أي تصاريح خلال الأيام السبعة القادمة.",
    ends: (date: string) => `ينتهي في ${date}`,
    endsToday: "ينتهي اليوم",
    daysLeft: (n: number) => `المتبقي ${count(n, "يوم واحد", "يومان", "أيام", "يومًا")}`,
    vehicleFallback: "مركبة",
    doorPrefix: (door: string) => `رقم الباب ${door} · `,
    statusTitle: "توزيع الحالات",
    statusDescLogistics: "التصاريح في المواقع المسندة إليك",
    statusDescAdmin: "التصاريح المسندة إليك",
    insightsTitle: "آخر 90 يومًا",
    insightsDescription: "أداء القرارات على مستوى الأسطول",
    submitted: "الطلبات المقدّمة",
    submittedHint: (decided: number, pending: number) =>
      `${decided} محسومة · ${pending} قيد الانتظار`,
    approvalRate: "نسبة الاعتماد",
    noDecisions: "لم تُسجَّل أي قرارات بعد",
    approvedRejected: (approved: number, rejected: number) =>
      `${approved} معتمدة · ${rejected} مرفوضة`,
    avgDecision: "متوسط وقت القرار",
    waitingFirstDecision: "بانتظار أول قرار",
    decisionSpan: "من التقديم حتى الاعتماد أو الرفض",
    topVehicle: "المركبة الأكثر طلبًا",
    topVehicleHint: (n: number) => `${requests(n)} في هذه الفترة`,
    noRequestsPeriod: "لا توجد طلبات في هذه الفترة",
    minutes: (n: number) => `${n} دقيقة`,
    hours: (value: string) => `${value} ساعة`,
    days: (value: string) => `${value} يوم`,
  },
  kpi: {
    active: "إجمالي التصاريح السارية",
    activeDesc: "معتمدة وصالحة حاليًا",
    pending: "طلبات بانتظار الاعتماد",
    pendingDesc: "بانتظار القرار",
    expiring: "تنتهي خلال 7 أيام",
    expiringDesc: "تحتاج إلى متابعة التجديد",
    fleet: "إجمالي مركبات الأسطول",
    fleetDesc: "نشطة في الدليل",
  },
  sectionCard: {
    viewAll: "عرض الكل",
  },
  statusBreakdown: {
    empty: "لم تُسجَّل أي تصاريح بعد.",
  },
  pagination: {
    showing: "عرض ",
    of: " من",
    rows: "عدد الصفوف",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
  },
};
