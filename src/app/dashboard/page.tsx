
import { Suspense } from "react";
export const dynamic = 'force-dynamic';
import { statCards } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { DashboardHeader } from "@/components/dashboard-header";
import { getUpcomingShipments, getClearedShipmentsMonthlySummary, getClearedContainerSummary, getPendingArrivedTotalLines } from "@/lib/firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardClient } from "@/components/dashboard-client";

async function StatCards() {
  const pendingArrivedTotalLines = await getPendingArrivedTotalLines();
  const cards = statCards.map((c) => (
    c.title === 'Pending Total Lines' ? { ...c, value: String(pendingArrivedTotalLines) } : c
  ));
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} card={card} />
      ))}
    </div>
  )
}

async function AsyncDashboard() {
  const results = await Promise.allSettled([
    getUpcomingShipments(),
    getClearedShipmentsMonthlySummary(),
    getClearedContainerSummary(),
  ]);
  const upcomingShipments = results[0].status === 'fulfilled' ? results[0].value : [];
  const shipmentLinesData = results[1].status === 'fulfilled' ? results[1].value : { monthlyData: [], sourceData: {}, monthlyBySource: {} };
  const containerData = results[2].status === 'fulfilled' ? results[2].value : { totalContainers: 0, monthlyData: [], sourceData: {} } as any;

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
