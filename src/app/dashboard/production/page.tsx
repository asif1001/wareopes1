export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardHeader } from '@/components/dashboard-header';
import { getWipShipments } from '@/lib/firebase/firestore';
import { makeSerializable } from '@/lib/serialization';
import { AdminRoute } from '@/components/AdminRoute';
import NextDynamic from 'next/dynamic';

// Lazy-load client page to keep server bundle light
const ProductionClientPage = NextDynamic(() => import('@/components/production-client-page').then(m => m.ProductionClientPage));

async function authorizeProductionView() {
  const c = await cookies();
  const rawSession = c.get('session')?.value;
  let userId: string | null = null;
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      userId = typeof parsed?.id === 'string' ? parsed.id : rawSession;
    } catch {
      userId = rawSession;
    }
  }
  if (!userId) {
    redirect('/');
  }

  const { getAdminDb } = await import('@/lib/firebase/admin');
  const adb = await getAdminDb();
  const snap = await adb.collection('Users').doc(userId!).get();
  const udata = snap.exists ? (snap.data() as any) : {};
  if (!udata?.role && !udata?.permissions) {
    redirect('/dashboard');
  }

  let permissions = udata?.permissions as any | undefined;
  if (!permissions && udata?.role) {
    const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).get();
    if (!rolesSnap.empty) {
      const roleData = rolesSnap.docs[0].data() as any;
      const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
      const normalized: any = {};
      for (const item of arr) {
        if (typeof item !== 'string') continue;
        const [page, action] = item.split(':');
        if (!page || !action) continue;
        (normalized[page] ||= []).push(action);
      }
      permissions = Object.keys(normalized).length ? normalized : undefined;
    }
  }
  const isAdmin = String(udata?.role || '').toLowerCase() === 'admin';
  const canViewProduction = isAdmin || (Array.isArray(permissions?.production) && permissions.production.includes('view'));
  if (!canViewProduction) {
    redirect('/dashboard');
  }
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