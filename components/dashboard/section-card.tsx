import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  /** Right-aligned summary shown next to the title, e.g. a count. */
  meta?: string;
  className?: string;
  children: ReactNode;
};

export function SectionCard({
  title,
  description,
  href,
  linkLabel = "View all",
  meta,
  className,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-[#e30613]/70"
          />
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            {description ? (
              <p className="text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {meta ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
              {meta}
            </span>
          ) : null}
          {href ? (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#e30613] hover:underline"
            >
              {linkLabel}
              <ArrowUpRight className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </header>
      <div className="flex-1 p-5">{children}</div>
    </section>
  );
}
