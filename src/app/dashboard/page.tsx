
import { Suspense } from "react";
export const dynamic = 'force-dynamic';
import { statCards } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { OverviewChart } from "@/components/overview-chart";
import { RecentShipments } from "@/components/recent-shipments";
import { DashboardHeader } from "@/components/dashboard-header";
import { getUpcomingShipments, getClearedShipmentsMonthlySummary, getClearedContainerSummary } from "@/lib/firebase/firestore";
import { ContainerOverview } from "@/components/container-overview";
import { Skeleton } from "@/components/ui/skeleton";

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
  const upcomingShipments = await getUpcomingShipments();
  const shipmentLinesData = await getClearedShipmentsMonthlySummary();
  const containerData = await getClearedContainerSummary();

  return (
    <>
      <StatCards />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-3 grid gap-4">
          <OverviewChart data={shipmentLinesData} />
          <ContainerOverview data={containerData} />
        </div>
        <div className="xl:col-span-2">
          <RecentShipments shipments={upcomingShipments} />
        </div>
      </div>
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
