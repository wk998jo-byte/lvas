"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { DEFAULT_LOCALE, intlLocale, localeDir, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { translateMessage } from "@/lib/i18n/messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const locale = useContext(LocaleContext);
  return useMemo(
    () => ({
      locale,
      dir: localeDir(locale),
      intl: intlLocale(locale),
      t: getDictionary(locale),
      tm: (message: string) => translateMessage(locale, message),
    }),
    [locale],
  );
}
