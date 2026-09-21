import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/guards";
import { getVehicleById } from "@/lib/db/queries";
import { VehicleDetailView } from "@/components/vehicles/vehicle-detail";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  let vehicle;
  try {
    vehicle = await getVehicleById(id);
  } catch (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Vehicle</h1>
        <p className="text-sm text-destructive" role="alert">
          Failed to load vehicle:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (!vehicle) notFound();

  return <VehicleDetailView vehicle={vehicle} />;
}
