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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, FileText, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function StatCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card) => (
        <StatCard key={card.title} card={card} />
      ))}
    </div>
  )
}

function ManagerQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Manager Tools
        </CardTitle>
        <CardDescription>
          Management oversight and reporting tools
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/reports">
            <FileText className="h-4 w-4 mr-2" />
            Performance Reports
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/tasks">
            <BarChart3 className="h-4 w-4 mr-2" />
            Team Tasks
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/feedback">
            <Users className="h-4 w-4 mr-2" />
            Team Feedback
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

async function AsyncManagerDashboard() {
  const upcomingShipments = await getUpcomingShipments();
  const shipmentLinesData = await getClearedShipmentsMonthlySummary();
  const containerData = await getClearedContainerSummary();

  return (
    <>
      <StatCards />
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-4 grid gap-4">
          <OverviewChart data={shipmentLinesData} />
          <ContainerOverview data={containerData} />
        </div>
        <div className="xl:col-span-2 grid gap-4">
          <RecentShipments shipments={upcomingShipments} />
          <ManagerQuickActions />
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
      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-4 grid gap-4">
          <Skeleton className="h-[350px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <div className="xl:col-span-2 grid gap-4">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    </>
  )
}

export default function ManagerDashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Manager Dashboard" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Suspense fallback={<DashboardSkeleton />}>
          <AsyncManagerDashboard />
        </Suspense>
      </main>
    </div>
  );
}