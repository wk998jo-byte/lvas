import Image from "next/image";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col bg-slate-50">
      <div aria-hidden className="h-1 w-full bg-[#e30613]" />

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/request" className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-mark.png"
              alt="Bin Quraya"
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
                Light Vehicle Authorization System · Bin Quraya
              </span>
            </span>
          </Link>

          <Button
            variant="outline"
            className="h-9 shrink-0 rounded-full border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50"
            render={<Link href="/login" />}
          >
            <LogIn className="size-3.5" />
            <span className="hidden sm:inline">Admin sign in</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-xs text-slate-500">
        <span className="font-semibold tracking-[0.14em] text-slate-700">
          LVAS
        </span>{" "}
        · بن قريعة Bin Quraya — after-hours light vehicle authorization
      </footer>
    </div>
  );
}
