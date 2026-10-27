export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import NextDynamic from 'next/dynamic';
import { guardPage } from '@/lib/permissions/server';
import { DashboardHeader } from '@/components/dashboard-header';
import { getWipShipments } from '@/lib/firebase/firestore';
import { makeSerializable } from '@/lib/serialization';
import type { SerializableShipment } from '@/lib/types';

// Lazy-load client page to keep server bundle light
const ProductivityClientPage = NextDynamic(() => import('@/components/productivity-client-page').then(m => m.ProductivityClientPage));

async function authorizeProductivityView() {
  await guardPage('productivity');
}

async function Productivity() {
  let serializableShipments: SerializableShipment[] | null = null;
  let message: string | null = null;
  try {
    await authorizeProductivityView();
    const shipments = await getWipShipments();
    serializableShipments = shipments.map(makeSerializable);
  } catch (err: any) {
    message = String(err?.message || err || "Unknown error");
  }

  return (
    <div className="flex flex-col h-full">
      <DashboardHeader title="Productivity" />
      <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
        {message ? (
          <div className="max-w-xl w-full border rounded-md p-6 bg-background">
            <h2 className="text-lg font-semibold mb-2">Unable to load Productivity page</h2>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <p className="text-sm text-muted-foreground">
              If this is a local environment, ensure Firebase Admin credentials are set in <code>.env.local</code> with either <code>FIREBASE_ADMIN_CREDENTIALS_BASE64</code> or <code>GOOGLE_APPLICATION_CREDENTIALS</code>, and include <code>FIREBASE_PROJECT_ID</code>. Then restart <code>npm run dev</code>.
            </p>
          </div>
        ) : (
          <ProductivityClientPage initialShipments={serializableShipments || []} />
        )}
      </main>
    </div>
  );
}

export default function ProductivityPage() {
  return <Productivity />;
}
