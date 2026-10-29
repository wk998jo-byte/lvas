import type { ShellDictionary } from "@/lib/i18n/dictionaries/en/shell";
import type { Translation } from "@/lib/i18n/types";

export const shellAr: Translation<ShellDictionary> = {
  nav: {
    dashboard: "لوحة التحكم",
    history: "سجل الطلبات",
    vehicles: "المركبات",
    employees: "الموظفون",
  },
  crumbs: {
    home: "الرئيسية",
    details: "التفاصيل",
    admin: "الإدارة",
  },
  titles: {
    dashboard: "لوحة التحكم",
    authorizationDetails: "تفاصيل التصريح",
    history: "سجل الطلبات",
    vehicleDetails: "تفاصيل المركبة",
    vehicles: "المركبات",
    changePassword: "تغيير كلمة المرور",
    employees: "الموظفون",
  },
  breadcrumb: "مسار التنقل",
  collapse: "طي القائمة",
  closeMenu: "إغلاق القائمة",
  userMenu: {
    accountMenu: "قائمة الحساب",
    userFallback: "مستخدم",
    changePassword: "تغيير كلمة المرور",
    signingOut: "جارٍ تسجيل الخروج…",
    signOut: "تسجيل الخروج",
  },
};
