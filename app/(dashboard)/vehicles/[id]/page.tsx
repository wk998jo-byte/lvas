import { notFound } from "next/navigation";

import { requireRole } from "@/lib/auth/guards";
import { getVehicleById } from "@/lib/db/queries";
import { getI18n } from "@/lib/i18n/server";
import { VehicleDetailView } from "@/components/vehicles/vehicle-detail";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const { t, tm, locale } = await getI18n();

  let vehicle;
  try {
    vehicle = await getVehicleById(id);
  } catch (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t.vehicles.detailPage.title}
        </h1>
        <p className="text-sm text-destructive" role="alert">
          {t.vehicles.detailPage.loadFailed}{" "}
          {error instanceof Error ? tm(error.message) : t.vehicles.page.unknownError}
        </p>
      </div>
    );
  }

  if (!vehicle) notFound();

  return <VehicleDetailView vehicle={vehicle} locale={locale} />;
}
