"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NextDynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { getPendingArrivedTotalLines } from "@/lib/firebase/firestore";
import { statCards } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import type { ClearedContainerSummary, ClearedShipmentSummary, SerializableShipment } from "@/lib/types";

// Props provided by the server page
export type DashboardClientProps = {
  shipmentLinesData: ClearedShipmentSummary;
  containerData: ClearedContainerSummary;
  upcomingShipments: SerializableShipment[];
};

// Explicit generics to satisfy component prop types
type OverviewChartProps = { data: ClearedShipmentSummary };
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
  const [pendingArrivedTotalLines, setPendingArrivedTotalLines] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const unauthorizedPage = searchParams.get('unauthorized');
    if (unauthorizedPage) {
      toast({
        title: 'Access Denied',
        description: `You do not have permission to view the "${unauthorizedPage}" page.`,
        variant: 'destructive',
      });
      // Clean up URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('unauthorized');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, toast]);

  useEffect(() => {
    let active = true;
    getPendingArrivedTotalLines()
      .then((value) => {
        if (active) setPendingArrivedTotalLines(value);
      })
      .catch(() => {
        if (active) setPendingArrivedTotalLines(0);
      });
    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo(() => {
    return statCards.map((card) => {
      if (card.title !== "Pending Total Lines") return card;
      const value = pendingArrivedTotalLines === null ? "..." : String(pendingArrivedTotalLines);
      return { ...card, value };
    });
  }, [pendingArrivedTotalLines]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.title} card={card} />
        ))}
      </div>
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
  );
}
