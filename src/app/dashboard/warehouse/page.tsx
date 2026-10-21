import { WarehouseClientPage } from "@/components/warehouse/warehouse-client-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function WarehousePage() {
  return <WarehouseClientPage />;
}
