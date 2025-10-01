import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNav } from "@/components/dashboard-nav";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
        <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4 rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading...</span>
        </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <Sidebar>
          <DashboardNav />
        </Sidebar>
        <SidebarInset>
          <Suspense fallback={<LoadingFallback />}>
            {children}
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
