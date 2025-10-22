
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { getShipments, getSources, getContainerSizes, getBranches } from "@/lib/firebase/firestore";
import { ShipmentsClientPage } from "@/components/shipments-client-page";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";

async function Shipments() {
  const t0 = Date.now();
  const shipments = await getShipments();
  console.log('[perf] getShipments', Date.now() - t0, 'ms');

  const t1 = Date.now();
  const sources = await getSources();
  console.log('[perf] getSources', Date.now() - t1, 'ms');

  const t2 = Date.now();
  const containerSizes = await getContainerSizes();
  console.log('[perf] getContainerSizes', Date.now() - t2, 'ms');

  const t3 = Date.now();
  const branches = await getBranches();
  console.log('[perf] getBranches', Date.now() - t3, 'ms');
  
  return (
    <ShipmentsClientPage
        shipments={shipments}
        sources={sources}
        containerSizes={containerSizes}
        branches={branches}
    />
  );
}

function ShipmentsSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Shipments" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <div className="flex items-center">
          <div className="flex gap-1">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-10 w-[300px]" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="flex-grow rounded-lg" />
      </main>
    </div>
  )
}


export default function ShipmentsPage() {
  return (
    <Suspense fallback={<ShipmentsSkeleton />}>
      <Shipments />
    </Suspense>
  )
}
