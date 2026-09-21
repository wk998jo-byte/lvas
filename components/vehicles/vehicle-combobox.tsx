"use client";

import { Combobox } from "@base-ui/react/combobox";
import { Car, Check, ChevronsUpDown, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Vehicle } from "@/types/database";

export type VehicleOption = Pick<
  Vehicle,
  "id" | "plate_number" | "make" | "model"
> & {
  year?: number | null;
  color?: string | null;
};

type VehicleComboboxProps = {
  id?: string;
  vehicles: VehicleOption[];
  value: VehicleOption | null;
  onValueChange: (vehicle: VehicleOption | null) => void;
  disabled?: boolean;
};

/** Plates are searchable with or without separators: "ABC 1234" ≈ "abc-1234". */
function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\-_]/g, "");
}

function haystack(vehicle: VehicleOption) {
  return normalize(
    [
      vehicle.plate_number,
      vehicle.make,
      vehicle.model,
      vehicle.year?.toString() ?? "",
      vehicle.color ?? "",
    ].join(" "),
  );
}

export function vehicleLabel(vehicle: VehicleOption) {
  return `${vehicle.plate_number} — ${vehicle.make} ${vehicle.model}`;
}

export function VehicleCombobox({
  id,
  vehicles,
  value,
  onValueChange,
  disabled,
}: VehicleComboboxProps) {
  return (
    <Combobox.Root<VehicleOption>
      items={vehicles}
      value={value}
      onValueChange={(next) => onValueChange(next)}
      disabled={disabled}
      autoHighlight
      limit={60}
      itemToStringLabel={vehicleLabel}
      itemToStringValue={(vehicle) => vehicle.id}
      isItemEqualToValue={(a, b) => a.id === b.id}
      filter={(vehicle, query) => {
        const q = normalize(query);
        if (!q) return true;
        return haystack(vehicle).includes(q);
      }}
    >
      <Combobox.InputGroup className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Combobox.Input
          id={id}
          placeholder="Search plate, make, or model…"
          className="h-11 w-full rounded-xl border border-slate-200/80 bg-white/90 pr-16 pl-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:border-[#e30613]/40 focus-visible:ring-3 focus-visible:ring-[#e30613]/15 disabled:opacity-50"
        />
        <div className="absolute inset-y-0 right-1 flex items-center">
          <Combobox.Clear
            aria-label="Clear selection"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </Combobox.Clear>
          <Combobox.Trigger
            aria-label="Open vehicle list"
            className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronsUpDown className="size-4" />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50 outline-none">
          <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-[var(--anchor-width)] max-w-[var(--available-width)] origin-[var(--transform-origin)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-[transform,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Combobox.Empty className="px-4 py-6 text-center text-sm text-slate-500">
              No vehicle matches your search.
            </Combobox.Empty>
            <Combobox.List className="max-h-[min(22rem,var(--available-height))] overflow-y-auto overscroll-contain p-1.5 data-empty:p-0">
              {(vehicle: VehicleOption) => (
                <Combobox.Item
                  key={vehicle.id}
                  value={vehicle}
                  className={cn(
                    "flex cursor-default items-center gap-3 rounded-xl px-2.5 py-2 outline-none select-none",
                    "data-highlighted:bg-slate-100 data-selected:bg-red-50",
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                    <Car className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {vehicle.plate_number}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {vehicle.make} {vehicle.model}
                      {vehicle.year ? ` · ${vehicle.year}` : ""}
                      {vehicle.color ? ` · ${vehicle.color}` : ""}
                    </span>
                  </span>
                  <Combobox.ItemIndicator className="text-[#e30613]">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
