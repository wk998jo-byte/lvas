type VehicleIdentity = {
  door_number?: string | null;
  plate_number: string;
  make: string;
  model: string;
  year?: number | null;
  color?: string | null;
};

export function vehicleLabel(vehicle: VehicleIdentity): string {
  const door = vehicle.door_number
    ? `Door ${vehicle.door_number}`
    : "Door No. unavailable";
  return `${door} — Plate ${vehicle.plate_number} — ${vehicle.make} ${vehicle.model}`;
}

export function compactVehicleIdentity(
  vehicle: Pick<VehicleIdentity, "door_number" | "plate_number">,
): string {
  return vehicle.door_number
    ? `${vehicle.door_number} · ${vehicle.plate_number}`
    : vehicle.plate_number;
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
  ].join(" ")).includes(normalize(query));
}
