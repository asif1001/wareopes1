import { Suspense } from "react";
export const dynamic = 'force-dynamic';
import { statCards } from "@/lib/data";
import { StatCard } from "@/components/stat-card";
import { RecentShipments } from "@/components/recent-shipments";
import { DashboardHeader } from "@/components/dashboard-header";
import { getUpcomingShipments } from "@/lib/firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Flag, MessageSquareWarning, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function EmployeeStatCards() {
  // Filter stat cards to show employee-relevant metrics
  const employeeStats = statCards.filter(card => 
    card.title !== "Total Revenue" // Hide revenue from employees
  );
  
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {employeeStats.map((card) => (
        <StatCard key={card.title} card={card} />
      ))}
    </div>
  )
}

function EmployeeQuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          My Work
        </CardTitle>
        <CardDescription>
          Quick access to your daily tasks and responsibilities
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/tasks">
            <Clock className="h-4 w-4 mr-2" />
            My Tasks
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/shipments">
            <Flag className="h-4 w-4 mr-2" />
            Shipments
          </Link>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <Link href="/dashboard/feedback">
            <MessageSquareWarning className="h-4 w-4 mr-2" />
            Submit Feedback
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

async function AsyncEmployeeDashboard() {
  const upcomingShipments = await getUpcomingShipments();

  return (
    <>
      <EmployeeStatCards />
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentShipments shipments={upcomingShipments} />
        <EmployeeQuickActions />
      </div>
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[126px]" />
        <Skeleton className="h-[126px]" />
        <Skeleton className="h-[126px]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </>
  )
}

export default function EmployeeDashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="My Dashboard" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <Suspense fallback={<DashboardSkeleton />}>
          <AsyncEmployeeDashboard />
        </Suspense>
      </main>
    </div>
  );
}