import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { plateLabel } from "@/lib/vehicles/identity";
export { plateLabel, isDoorNumberPlate, matchesVehicleSearch as vehicleSearchMatches } from "@/lib/vehicles/identity";

type VehiclePlateIdentity = {
  plate_number: string | null;
  door_number?: string | null;
};

const PLATE_UNAVAILABLE = "Plate unavailable";

/** plateLabel with the "unavailable" fallback in the requested language. */
export function localizedPlateLabel(
  vehicle: VehiclePlateIdentity,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const label = plateLabel(vehicle);
  return label === PLATE_UNAVAILABLE
    ? getDictionary(locale).vehicles.identity.plateUnavailable
    : label;
}

export function plateFieldValue(
  vehicle: VehiclePlateIdentity,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const label = plateLabel(vehicle);
  return label === PLATE_UNAVAILABLE
    ? getDictionary(locale).vehicles.identity.unavailable
    : label;
}

export function vehicleIdentityLabel(
  vehicle: VehiclePlateIdentity,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const { identity } = getDictionary(locale).vehicles;
  const door = vehicle.door_number?.trim();
  const plate = plateLabel(vehicle);
  const plateText =
    plate === PLATE_UNAVAILABLE ? identity.plateUnavailable : identity.plate(plate);
  return `${door ? identity.door(door) : identity.doorUnavailable} · ${plateText}`;
}

/** "Door 006-01-736", or the plate when the vehicle has no door number. */
export function vehicleShortLabel(
  vehicle: VehiclePlateIdentity,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return vehicle.door_number
    ? getDictionary(locale).vehicles.identity.door(vehicle.door_number)
    : localizedPlateLabel(vehicle, locale);
}
