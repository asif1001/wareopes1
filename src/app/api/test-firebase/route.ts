import { NextResponse } from 'next/server';
// Dynamically import admin helper to avoid bundling firebase-admin into the Next.js client build
import { db, app } from '@/lib/firebase/firebase';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { collection, limit, query, getDocs } from 'firebase/firestore';

export async function GET() {
  const result: any = {
    admin: { ok: false, error: null as null | string },
    client: { ok: false, error: null as null | string },
  };

  // Admin check
  try {
  const { getAdminDb } = await import('@/lib/firebase/admin');
  const adb = await getAdminDb();
    const snap = await adb.collection('Users').limit(1).get();
    result.admin.ok = true;
    result.admin.count = snap.size;
  } catch (e: any) {
    result.admin.error = e?.message || String(e);
  }

  // Client check
  try {
    const auth = getAuth(app);
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    const q = query(collection(db, 'Users'), limit(1));
    const snap = await getDocs(q);
    result.client.ok = true;
    result.client.count = snap.size;
  } catch (e: any) {
    result.client.error = e?.message || String(e);
  }

  return NextResponse.json(result);
}
