import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  intlLocale,
  isLocale,
  LOCALE_COOKIE,
  localeDir,
  type Locale,
} from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { translateMessage } from "@/lib/i18n/messages";

/** Server Components and Server Actions only. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getI18n() {
  const locale = await getLocale();
  return {
    locale,
    dir: localeDir(locale),
    intl: intlLocale(locale),
    t: getDictionary(locale),
    tm: (message: string) => translateMessage(locale, message),
  };
}
