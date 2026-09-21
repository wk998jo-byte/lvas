"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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

type VehicleDirectoryProps = {
  vehicles: Vehicle[];
};

function matches(vehicle: Vehicle, query: string) {
  return [
    vehicle.plate_number,
    vehicle.make,
    vehicle.model,
    vehicle.color ?? "",
    vehicle.year?.toString() ?? "",
    vehicle.notes ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function VehicleDirectory({ vehicles }: VehicleDirectoryProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => matches(vehicle, q));
  }, [vehicles, deferredQuery]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, pageSize]);

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={Car}
        title="No vehicles yet"
        description="Active light vehicles will appear here once the fleet directory is populated."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search plate, make, model, color…"
            className="h-10 rounded-xl border-slate-200 pl-10"
          />
        </div>
        <p className="text-sm text-slate-500">
          <span className="font-medium text-slate-700">{filtered.length}</span>{" "}
          of {vehicles.length} vehicle{vehicles.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Search}
            title="No matches"
            description="Try another plate number, make, or model."
          />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Make &amp; model</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell className="font-semibold text-slate-900">
                    {vehicle.plate_number}
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
                  <TableCell className="text-right">
                    <Link
                      href={`/vehicles/${vehicle.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#e30613] hover:underline"
                    >
                      View
                      <ArrowUpRight className="size-3.5" />
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
