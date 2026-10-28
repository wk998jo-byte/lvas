import Image from "next/image";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { LanguageSwitch } from "@/components/i18n/language-switch";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = await getI18n();
  const copy = t.public.layout;

  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <div aria-hidden className="h-1 w-full bg-[#e30613]" />

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/request" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-mark.png"
              alt={t.common.companyName}
              width={44}
              height={44}
              priority
              className="size-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-2xl leading-none font-extrabold tracking-[0.16em] text-slate-900">
                  LVAS
                </span>
                <span className="size-1.5 rounded-full bg-[#e30613]" />
              </span>
              <span className="mt-1 block truncate text-[11px] font-medium text-slate-500">
                {copy.tagline}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitch className="px-2.5 sm:px-3" />
            <Link
              href="/status"
              className="rounded-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {copy.trackRequests}
            </Link>
            <Button
              variant="outline"
              className="h-9 shrink-0 rounded-full border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
              render={<Link href="/login" />}
            >
              <LogIn className="size-3.5 rtl:rotate-180" />
              <span className="hidden sm:inline">{copy.adminSignIn}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        <span className="font-semibold tracking-[0.14em] text-slate-700">
          LVAS
        </span>{" "}
        {copy.footer}
      </footer>
    </div>
  );
}
