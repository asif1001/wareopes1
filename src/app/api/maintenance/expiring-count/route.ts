export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';
import type { Query, DocumentData } from 'firebase-admin/firestore';

function daysUntil(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  try {
    const now = new Date();
    const target = new Date(dateISO);
    const diffMs = target.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { ok, role, permissions, branch } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const adb = await getAdminDb();

    const vehiclesRef = adb.collection('vehicles');
    // Use a Query type so branch scoping via `.where` does not cause TS errors
    const q: Query<DocumentData> = (!isAdmin(role) && branch)
      ? vehiclesRef.where('branch', '==', branch)
      : vehiclesRef;
    const snap = await q.get();
    let count = 0;

    snap.forEach((doc) => {
      const v = doc.data() || {};
      const insDays = daysUntil(v.insuranceExpiry ?? null);
      const regDays = daysUntil(v.registrationExpiry ?? null);
      const svcDays = daysUntil(v.nextServiceDueDate ?? null);
      const soon = (d: number | null) => d != null && d >= 0 && d <= 30;
      if (soon(insDays) || soon(regDays) || soon(svcDays)) {
        count += 1;
      }
    });

    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    console.error('GET /api/maintenance/expiring-count error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}