"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/export/csv";

type ExportCsvButtonProps = {
  filename: string;
  rows: Array<Record<string, string | number | boolean | null | undefined>>;
  label?: string;
  disabled?: boolean;
};

export function ExportCsvButton({
  filename,
  rows,
  label = "Export to CSV",
  disabled,
}: ExportCsvButtonProps) {
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
      {label}
    </Button>
  );
}
