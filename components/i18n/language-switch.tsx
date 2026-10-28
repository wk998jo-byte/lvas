"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { setLocale } from "@/actions/locale";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
      disabled={pending}
      aria-label={t.common.language.switchLabel}
      lang={next}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-[#e30613]/40 hover:text-[#e30613] disabled:opacity-60",
        className,
      )}
    >
      <Languages className="size-4" aria-hidden />
      {t.common.language.switchTo}
    </button>
  );
}
