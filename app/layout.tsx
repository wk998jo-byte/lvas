import type { Metadata } from "next";
import { Geist_Mono, IBM_Plex_Sans_Arabic, Outfit } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { getI18n } from "@/lib/i18n/server";

import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: `LVAS — ${t.common.companyName}`,
    description: `${t.common.appFullName} — ${t.common.companyName}`,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir } = await getI18n();
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${outfit.variable} ${plexArabic.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans antialiased">
        <I18nProvider locale={locale}>
          <Suspense fallback={null}>{children}</Suspense>
          <Toaster
            theme="light"
            richColors
            position="top-center"
            dir={dir}
          />
        </I18nProvider>
      </body>
    </html>
  );
}
