"use client";

import NextDynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClearedContainerSummary, SerializableShipment } from "@/lib/types";

// Props provided by the server page
export type DashboardClientProps = {
  shipmentLinesData: any[];
  containerData: ClearedContainerSummary;
  upcomingShipments: SerializableShipment[];
};

// Explicit generics to satisfy component prop types
type OverviewChartProps = { data: any[] };
type ContainerOverviewProps = { data: ClearedContainerSummary };
type RecentShipmentsProps = { shipments: SerializableShipment[] };

const OverviewChart = NextDynamic<OverviewChartProps>(() => import("@/components/overview-chart").then(m => m.OverviewChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[418px]" />,
});

const ContainerOverview = NextDynamic<ContainerOverviewProps>(() => import("@/components/container-overview").then(m => m.ContainerOverview), {
  ssr: false,
  loading: () => <Skeleton className="h-[350px]" />,
});

const RecentShipments = NextDynamic<RecentShipmentsProps>(() => import("@/components/recent-shipments").then(m => m.RecentShipments), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[500px]" />,
});

export function DashboardClient({ shipmentLinesData, containerData, upcomingShipments }: DashboardClientProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
      <div className="xl:col-span-3 grid gap-4">
        <OverviewChart data={shipmentLinesData} />
        <ContainerOverview data={containerData} />
      </div>
      <div className="xl:col-span-2">
        <RecentShipments shipments={upcomingShipments} />
      </div>
    </div>
  );
}