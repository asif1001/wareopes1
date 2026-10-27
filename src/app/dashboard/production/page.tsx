export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { guardPage } from '@/lib/permissions/server';
import { DashboardHeader } from '@/components/dashboard-header';
import { getWipShipments } from '@/lib/firebase/firestore';
import { makeSerializable } from '@/lib/serialization';
import { AdminRoute } from '@/components/AdminRoute';
import NextDynamic from 'next/dynamic';

// Lazy-load client page to keep server bundle light
const ProductionClientPage = NextDynamic(() => import('@/components/production-client-page').then(m => m.ProductionClientPage));

async function authorizeProductionView() {
  await guardPage('production');
}

async function Production() {
  await authorizeProductionView();

  const shipments = await getWipShipments();
  const serializableShipments = shipments.map(makeSerializable);

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Production" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        <ProductionClientPage initialShipments={serializableShipments} />
      </main>
    </div>
  );
}

export default function ProductionPage() {
  return <Production />;
}