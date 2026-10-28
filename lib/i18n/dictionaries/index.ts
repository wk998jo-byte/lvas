import { approvalsAr } from "@/lib/i18n/dictionaries/ar/approvals";
import { authAr } from "@/lib/i18n/dictionaries/ar/auth";
import { commonAr } from "@/lib/i18n/dictionaries/ar/common";
import { dashboardAr } from "@/lib/i18n/dictionaries/ar/dashboard";
import { employeesAr } from "@/lib/i18n/dictionaries/ar/employees";
import { publicAr } from "@/lib/i18n/dictionaries/ar/public";
import { shellAr } from "@/lib/i18n/dictionaries/ar/shell";
import { vehiclesAr } from "@/lib/i18n/dictionaries/ar/vehicles";
import { approvalsEn } from "@/lib/i18n/dictionaries/en/approvals";
import { authEn } from "@/lib/i18n/dictionaries/en/auth";
import { commonEn } from "@/lib/i18n/dictionaries/en/common";
import { dashboardEn } from "@/lib/i18n/dictionaries/en/dashboard";
import { employeesEn } from "@/lib/i18n/dictionaries/en/employees";
import { publicEn } from "@/lib/i18n/dictionaries/en/public";
import { shellEn } from "@/lib/i18n/dictionaries/en/shell";
import { vehiclesEn } from "@/lib/i18n/dictionaries/en/vehicles";
import type { Locale } from "@/lib/i18n/config";
import type { Translation } from "@/lib/i18n/types";

const en = {
  common: commonEn,
  public: publicEn,
  auth: authEn,
  shell: shellEn,
  dashboard: dashboardEn,
  approvals: approvalsEn,
  vehicles: vehiclesEn,
  employees: employeesEn,
};

export type Dictionary = Translation<typeof en>;

const ar: Dictionary = {
  common: commonAr,
  public: publicAr,
  auth: authAr,
  shell: shellAr,
  dashboard: dashboardAr,
  approvals: approvalsAr,
  vehicles: vehiclesAr,
  employees: employeesAr,
};

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
