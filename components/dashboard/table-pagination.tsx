"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export const PAGE_SIZES = [25, 50, 100] as const;

type TablePaginationProps = {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  from,
  to,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const { t } = useI18n();
  const copy = t.dashboard.pagination;
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-500">
        {copy.showing}<span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span>{copy.of}{" "}
        <span className="font-medium text-slate-700">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-500">
          {copy.rows}
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus-visible:border-[#e30613]/40"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={copy.previous}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Button>
          <span className="px-2 text-sm tabular-nums text-slate-600">
            {page} / {pageCount}
          </span>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label={copy.next}
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </div>
      </div>
    </div>
  );
}
