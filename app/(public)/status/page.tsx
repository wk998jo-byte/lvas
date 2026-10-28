import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { BadgeStatusForm } from "@/components/public/badge-status-form";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.public.status.metaTitle,
    description: t.public.status.metaDescription,
  };
}

export const dynamic = "force-dynamic";

export default async function BadgeStatusPage() {
  const { t } = await getI18n();
  const copy = t.public.status;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-[#e30613] uppercase">
          <ClipboardList className="size-3.5" />
          {copy.eyebrow}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
          {copy.title}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">{copy.intro}</p>
        <p className="text-sm text-slate-500">
          {copy.needNew}{" "}
          <Link
            href="/request"
            className="font-semibold text-[#e30613] underline-offset-4 hover:underline"
          >
            {copy.submitRequest}
          </Link>
        </p>
      </header>
      <BadgeStatusForm />
    </div>
  );
}
