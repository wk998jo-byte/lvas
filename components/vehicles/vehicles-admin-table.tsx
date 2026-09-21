"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { Car, Eye, Pencil, Plus, Power, PowerOff, Search } from "lucide-react";
import { toast } from "sonner";

import {
  createVehicle,
  deactivateVehicle,
  reactivateVehicle,
  updateVehicle,
} from "@/actions/vehicles";
import { EmptyState } from "@/components/dashboard/empty-state";
import { ExportCsvButton } from "@/components/export/export-csv-button";
import {
  VehicleForm,
  type VehicleFormState,
} from "@/components/vehicles/vehicle-form";
import {
  PAGE_SIZES,
  TablePagination,
} from "@/components/dashboard/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Vehicle } from "@/types/database";

type VehiclesAdminTableProps = {
  vehicles: Vehicle[];
};

type FilterKey = "all" | "active" | "inactive";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

export function VehiclesAdminTable({ vehicles }: VehiclesAdminTableProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [pending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);

  const counts = useMemo(() => {
    return {
      all: vehicles.length,
      active: vehicles.filter((v) => v.is_active).length,
      inactive: vehicles.filter((v) => !v.is_active).length,
    };
  }, [vehicles]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      if (filter === "active" && !vehicle.is_active) return false;
      if (filter === "inactive" && vehicle.is_active) return false;
      if (!q) return true;
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
        .includes(q);
    });
  }, [vehicles, deferredQuery, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, filter, pageSize]);

  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  function runCreate(values: VehicleFormState) {
    setFormError(null);
    startTransition(async () => {
      const result = await createVehicle(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Vehicle created");
      setCreateOpen(false);
    });
  }

  function runUpdate(values: VehicleFormState) {
    if (!editing) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateVehicle({ id: editing.id, ...values });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Vehicle updated");
      setEditing(null);
    });
  }

  function runDeactivate(vehicle: Vehicle) {
    startTransition(async () => {
      const result = await deactivateVehicle({ id: vehicle.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${vehicle.plate_number} deactivated`);
    });
  }

  function runReactivate(vehicle: Vehicle) {
    startTransition(async () => {
      const result = await reactivateVehicle({ id: vehicle.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${vehicle.plate_number} reactivated`);
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search plate, make, model, color…"
              className="h-10 rounded-xl border-slate-200 pl-10"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportCsvButton
              filename={`lvas-vehicles-${new Date().toISOString().slice(0, 10)}.csv`}
              rows={filtered.map((vehicle) => ({
                id: vehicle.id,
                plate_number: vehicle.plate_number,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                is_active: vehicle.is_active,
                notes: vehicle.notes,
                created_at: vehicle.created_at,
                updated_at: vehicle.updated_at,
              }))}
            />
            <Button
              type="button"
              className="rounded-full"
              onClick={() => {
                setFormError(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add vehicle
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-[#e30613] bg-[#e30613] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {counts[item.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={Car}
            title={
              vehicles.length === 0 ? "No vehicles yet" : "No matching vehicles"
            }
            description={
              vehicles.length === 0
                ? "Add the first plate to the fleet directory to get started."
                : "Try another search term or status filter."
            }
            action={
              vehicles.length === 0 ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => {
                    setFormError(null);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  Add vehicle
                </Button>
              ) : undefined
            }
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((vehicle) => (
                <TableRow
                  key={vehicle.id}
                  className={cn(!vehicle.is_active && "bg-slate-50/40")}
                >
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
                  <TableCell>
                    <Badge
                      className={cn(
                        vehicle.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                          : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      {vehicle.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${vehicle.plate_number}`}
                        title="Edit"
                        disabled={pending}
                        onClick={() => {
                          setFormError(null);
                          setEditing(vehicle);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`View ${vehicle.plate_number}`}
                        title="View details"
                        render={<Link href={`/vehicles/${vehicle.id}`} />}
                      >
                        <Eye className="size-4" />
                      </Button>
                      {vehicle.is_active ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Deactivate ${vehicle.plate_number}`}
                          title="Deactivate"
                          className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          disabled={pending}
                          onClick={() => runDeactivate(vehicle)}
                        >
                          <PowerOff className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Reactivate ${vehicle.plate_number}`}
                          title="Reactivate"
                          className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          disabled={pending}
                          onClick={() => runReactivate(vehicle)}
                        >
                          <Power className="size-4" />
                        </Button>
                      )}
                    </div>
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormError(null);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
            <DialogDescription>
              Create a directory entry available for authorization requests.
            </DialogDescription>
          </DialogHeader>
          <VehicleForm
            key={createOpen ? "create-open" : "create-closed"}
            submitLabel="Create vehicle"
            pending={pending}
            error={formError}
            onCancel={() => setCreateOpen(false)}
            onSubmit={runCreate}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
            <DialogDescription>
              Update plate details for {editing?.plate_number}.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <VehicleForm
              key={editing.id}
              initial={editing}
              submitLabel="Save changes"
              pending={pending}
              error={formError}
              onCancel={() => setEditing(null)}
              onSubmit={runUpdate}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
