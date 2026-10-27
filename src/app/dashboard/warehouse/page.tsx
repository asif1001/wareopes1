import { guardPage } from "@/lib/permissions/server";
import { WarehouseClientPage } from "@/components/warehouse/warehouse-client-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function WarehousePage() {
  await guardPage("warehouse");
  return <WarehouseClientPage />;
}
