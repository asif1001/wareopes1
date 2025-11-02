export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import NextDynamic from 'next/dynamic';
import { DashboardHeader } from '@/components/dashboard-header';
import { getWipShipments } from '@/lib/firebase/firestore';
import { makeSerializable } from '@/lib/serialization';

// Lazy-load client page to keep server bundle light
const ProductivityClientPage = NextDynamic(() => import('@/components/productivity-client-page').then(m => m.ProductivityClientPage));

async function authorizeProductivityView() {
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
  const canViewProductivity = isAdmin || (Array.isArray(permissions?.productivity) && permissions.productivity.includes('view'));
  if (!canViewProductivity) {
    redirect('/dashboard');
  }
}

async function Productivity() {
  try {
    await authorizeProductivityView();
    const shipments = await getWipShipments();
    const serializableShipments = shipments.map(makeSerializable);
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Productivity" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <ProductivityClientPage initialShipments={serializableShipments} />
        </main>
      </div>
    );
  } catch (err: any) {
    const message = String(err?.message || err || 'Unknown error');
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Productivity" />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full border rounded-md p-6 bg-background">
            <h2 className="text-lg font-semibold mb-2">Unable to load Productivity page</h2>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <p className="text-sm text-muted-foreground">If this is a local environment, ensure Firebase Admin credentials are set in <code>.env.local</code> with either <code>FIREBASE_ADMIN_CREDENTIALS_BASE64</code> or <code>GOOGLE_APPLICATION_CREDENTIALS</code>, and include <code>FIREBASE_PROJECT_ID</code>. Then restart <code>npm run dev</code>.</p>
          </div>
        </main>
      </div>
    );
  }
}

export default function ProductivityPage() {
  return <Productivity />;
}