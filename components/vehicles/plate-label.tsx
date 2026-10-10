import { plateLabel } from "@/lib/vehicles/identity";
export { plateLabel, isDoorNumberPlate, matchesVehicleSearch as vehicleSearchMatches } from "@/lib/vehicles/identity";

type VehiclePlateIdentity = {
  plate_number: string | null;
  door_number?: string | null;
};

export function plateFieldValue(vehicle: VehiclePlateIdentity): string {
  const label = plateLabel(vehicle);
  return label === "Plate unavailable" ? "Unavailable" : label;
}

export function vehicleIdentityLabel(vehicle: VehiclePlateIdentity): string {
  const door = vehicle.door_number?.trim();
  const plate = plateLabel(vehicle);
  const plateText = plate === "Plate unavailable" ? plate : `Plate ${plate}`;
  return `${door ? `Door ${door}` : "Door No. unavailable"} · ${plateText}`;
}


