
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeader } from "@/components/dashboard-header";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { OilStatusClientPage } from "@/components/oil-status-client-page";

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

async function OilStatus() {
  // Simulate data fetching or replace with actual API calls later
  // const oilData = await getOilData(); 
  
  return (
    <OilStatusClientPage 
      // data={oilData}
    />
  );
}

function OilStatusSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Oil Status" />
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

export default function OilStatusPage() {
  return (
    <Suspense fallback={<OilStatusSkeleton />}>
      <OilStatus />
    </Suspense>
  )
}
