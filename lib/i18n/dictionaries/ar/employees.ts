import type { EmployeesDictionary } from "@/lib/i18n/dictionaries/en/employees";
import type { Translation } from "@/lib/i18n/types";

export const employeesAr: Translation<EmployeesDictionary> = {
  page: {
    title: "الموظفون",
    loadFailed: (message: string) => `تعذّر تحميل الموظفين: ${message}`,
    unknownError: "خطأ غير معروف",
    hrDirectory: "دليل الموارد البشرية",
    description:
      "مستوردة من السجل الرئيسي للموارد البشرية. هذه السجلات دليل مرجعي — وليست حسابات تسجيل دخول.",
    total: "الإجمالي",
    managers: "المدراء",
    supervisors: "المشرفون",
  },
  browser: {
    filterAll: "الكل",
    filterManagers: "المدراء",
    filterSupervisors: "المشرفون",
    filterOther: "موظفون آخرون",
    searchPlaceholder: "ابحث بالرقم الوظيفي أو الاسم أو الهوية أو الجوال أو القسم أو المسمى الوظيفي…",
    matching: (total: number) => (total === 1 ? "موظف مطابق" : "موظفين مطابقين"),
    noMatchingTitle: "لا يوجد موظفون مطابقون",
    noEmployeesTitle: "لا يوجد موظفون بعد",
    noMatchingDescription: "جرّب رقمًا وظيفيًا أو اسمًا أو قسمًا أو مسمى وظيفيًا آخر.",
    noEmployeesDescription: "شغّل سكربت استيراد الموظفين لتعبئة الدليل.",
    badge: "الرقم الوظيفي",
    name: "الاسم",
    department: "القسم",
    position: "المسمى الوظيفي",
    category: "الفئة",
    mobile: "الجوال",
    showing: "عرض",
    of: "من",
    rows: "الصفوف",
    previous: "السابق",
    next: "التالي",
  },
};
