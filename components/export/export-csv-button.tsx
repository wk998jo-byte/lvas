"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export/csv";
import { useI18n } from "@/lib/i18n/client";

type ExportCsvButtonProps = {
  filename: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  label?: string;
  disabled?: boolean;
};

export function ExportCsvButton({
  filename,
  rows,
  label,
  disabled,
}: ExportCsvButtonProps) {
  const { t } = useI18n();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={disabled || rows.length === 0}
      onClick={() => downloadCsv(filename, rows)}
    >
      <Download className="size-3.5" />
      {label ?? t.approvals.exportCsv.button}
    </Button>
  );
}
