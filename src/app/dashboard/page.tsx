
import { Suspense } from "react";
export const dynamic = 'force-dynamic';
import { statCards } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { DashboardHeader } from "@/components/dashboard-header";
import { getUpcomingShipments, getClearedShipmentsMonthlySummary, getClearedContainerSummary } from "@/lib/firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardClient } from "@/components/dashboard-client";

function StatCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card) => (
        <StatCard key={card.title} card={card} />
      ))}
    </div>
  )
}

async function AsyncDashboard() {
  const [upcomingShipments, shipmentLinesData, containerData] = await Promise.all([
    getUpcomingShipments(),
    getClearedShipmentsMonthlySummary(),
    getClearedContainerSummary(),
  ]);

  return (
    <>
      <StatCards />
      <DashboardClient
        shipmentLinesData={shipmentLinesData}
        containerData={containerData}
        upcomingShipments={upcomingShipments}
      />
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[126px]" />
        <Skeleton className="h-[126px]" />
        <Skeleton className="h-[126px]" />
        <Skeleton className="h-[126px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-3 grid gap-4">
          <Skeleton className="h-[418px]" />
          <Skeleton className="h-[350px]" />
        </div>
        <div className="xl:col-span-2">
          <Skeleton className="h-full min-h-[500px]" />
        </div>
      </div>
    </>
  )
}


export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Dashboard" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Suspense fallback={<DashboardSkeleton />}>
          <AsyncDashboard />
        </Suspense>
      </main>
    </div>
  );
}
