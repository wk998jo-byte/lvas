import { redirect } from "next/navigation";

/** Legacy admin route — fleet management now lives on /vehicles. */
export default function AdminVehiclesRedirectPage() {
  redirect("/vehicles");
}
