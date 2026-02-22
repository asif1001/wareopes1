export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { DispatchesClientPage } from "@/components/dispatches-client-page";
import { Suspense } from "react";
import { DashboardHeader } from "@/components/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getDispatches, getUsers, getContainerSizes } from "@/lib/firebase/firestore";
import type { SerializableDispatch, User, ContainerSize } from "@/lib/types";

async function Dispatches() {
  let dispatches: SerializableDispatch[] = [];
  let users: User[] = [];
  let containerSizes: ContainerSize[] = [];
  try {
    const results = await Promise.all([
      getDispatches(),
      getUsers(),
      getContainerSizes(),
    ]);
    dispatches = results[0];
    users = results[1];
    containerSizes = results[2];
  } catch {
    dispatches = [];
    users = [];
    containerSizes = [];
  }
  return (
    <DispatchesClientPage
      dispatches={dispatches}
      users={users}
      containerSizes={containerSizes}
    />
  );
}

function DispatchesSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Dispatches" />
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
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="flex-grow rounded-lg" />
      </main>
    </div>
  )
}


export default function DispatchesPage() {
  return (
    <Suspense fallback={<DispatchesSkeleton />}>
      <Dispatches />
    </Suspense>
  )
}
