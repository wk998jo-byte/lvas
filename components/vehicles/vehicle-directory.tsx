"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowUpRight, Car, Search } from "lucide-react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PAGE_SIZES,
  TablePagination,
} from "@/components/dashboard/table-pagination";
import type { Vehicle } from "@/types/database";
import { plateFieldValue } from "@/components/vehicles/plate-label";
import { useI18n } from "@/lib/i18n/client";
import { matchesVehicleSearch } from "@/lib/vehicles/identity";

type VehicleDirectoryProps = {
  vehicles: Vehicle[];
};

export function VehicleDirectory({ vehicles }: VehicleDirectoryProps) {
  const { t, locale } = useI18n();
  const copy = t.vehicles.table;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => matchesVehicleSearch(vehicle, q));
  }, [vehicles, deferredQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  const [paginationInputs, setPaginationInputs] = useState({ query: deferredQuery, pageSize });
  if (paginationInputs.query !== deferredQuery || paginationInputs.pageSize !== pageSize) {
    setPaginationInputs({ query: deferredQuery, pageSize });
    setPage(1);
  }

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={Car}
        title={copy.noVehiclesTitle}
        description={copy.noVehiclesDirectoryDescription}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            className="h-10 rounded-xl border-slate-200 ps-10"
          />
        </div>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{filtered.length}</span>{" "}
          {copy.ofTotal(vehicles.length)}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Search}
            title={copy.noMatchesTitle}
            description={copy.noMatchesDescription}
          />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.doorNumber}</TableHead>
                <TableHead>{copy.plate}</TableHead>
                <TableHead>{copy.makeModel}</TableHead>
                <TableHead>{copy.year}</TableHead>
                <TableHead>{copy.color}</TableHead>
                <TableHead className="text-end">{copy.details}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-semibold tabular-nums text-slate-900">
                    {vehicle.door_number ?? "—"}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {plateFieldValue(vehicle, locale)}
                  </TableCell>
                  <TableCell>
                    {vehicle.make} {vehicle.model}
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-500">
                    {vehicle.year ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {vehicle.color ?? "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#e30613] hover:underline"
                    >
                      {copy.view}
                      <ArrowUpRight className="size-3.5 rtl:-scale-x-100" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <TablePagination
            page={currentPage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={filtered.length}
            from={start + 1}
            to={start + rows.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
