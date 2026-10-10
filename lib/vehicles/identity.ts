type VehicleIdentity = {
  door_number?: string | null;
  plate_number: string | null;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
  notes?: string | null;
};

/** Suppress old fake registration plates in presentation, never rewrite data. */
export function plateLabel(
  vehicle: { plate_number: string | null; door_number?: string | null },
): string {
  const plate = vehicle.plate_number?.trim();
  return !plate || isDoorNumberPlate(plate, vehicle.door_number) ? "Plate unavailable" : plate;
}

export function isDoorNumberPlate(plate: string | null, door?: string | null): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s\-_]/g, "");
  return Boolean(plate?.trim() && (
    /^006-\d{2}-\d{3,}$/.test(plate.trim()) ||
    (door?.trim() && normalize(plate) === normalize(door))
  ));
}

export function vehicleLabel(vehicle: VehicleIdentity): string {
  const door = vehicle.door_number
    ? `Door ${vehicle.door_number}`
    : "Door No. unavailable";
  const plate = plateLabel(vehicle);
  return `${door} — ${plate === "Plate unavailable" ? plate : `Plate ${plate}`} — ${vehicle.make} ${vehicle.model}`;
}

export function compactVehicleIdentity(
  vehicle: Pick<VehicleIdentity, "door_number" | "plate_number">,
): string {
  return vehicle.door_number
    ? `${vehicle.door_number} · ${plateLabel(vehicle)}`
    : plateLabel(vehicle);
}

/** Keep the existing separator-insensitive plate search; also search doors. */
export function matchesVehicleSearch(vehicle: VehicleIdentity, query: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[\s\-_]/g, "");
  return normalize([
    vehicle.door_number ?? "",
    vehicle.plate_number,
    vehicle.make,
    vehicle.model,
    vehicle.year?.toString() ?? "",
    vehicle.color ?? "",
    vehicle.notes ?? "",
  ].join(" ")).includes(normalize(query));
}
