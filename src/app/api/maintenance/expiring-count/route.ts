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
    
    // Helper to get date range for queries
    const now = new Date();
    const target = new Date();
    target.setDate(now.getDate() + 60);
    const nowISO = now.toISOString();
    const targetISO = target.toISOString();

    // Use a Set to track unique IDs of expiring items
    const expiringIds = new Set<string>();

    // Helper to execute query and add IDs to set
    const checkQuery = async (query: Query<DocumentData>) => {
      const snap = await query.get();
      snap.forEach(doc => expiringIds.add(`vehicle-${doc.id}`));
    };

    // 1. Vehicles - Check each date field independently
    // Note: We need 3 separate queries because we can't perform OR across different fields efficiently
    const baseQuery = (!isAdmin(role) && branch)
      ? vehiclesRef.where('branch', '==', branch)
      : vehiclesRef;

    const vPromises = [
      checkQuery(baseQuery.where('insuranceExpiry', '>=', nowISO).where('insuranceExpiry', '<=', targetISO)),
      checkQuery(baseQuery.where('registrationExpiry', '>=', nowISO).where('registrationExpiry', '<=', targetISO)),
      checkQuery(baseQuery.where('nextServiceDueDate', '>=', nowISO).where('nextServiceDueDate', '<=', targetISO))
    ];

    // 2. MHEs
    const mhesRef = adb.collection('mhes');
    // Note: MHEs might filter by branch if needed, but original code didn't. 
    // Assuming global access or filtered later? Original code: adb.collection('mhes').get() (no branch filter)
    const mPromise = (async () => {
      const snap = await mhesRef.where('certification.expiry', '>=', nowISO).where('certification.expiry', '<=', targetISO).get();
      snap.forEach(doc => expiringIds.add(`mhe-${doc.id}`));
    })();

    // 3. Gatepasses
    const gpRef = adb.collection('gatepasses');
    // Original code: adb.collection('gatepasses').get() (no branch filter)
    const gPromise = (async () => {
      const snap = await gpRef.where('expiryDate', '>=', nowISO).where('expiryDate', '<=', targetISO).get();
      snap.forEach(doc => expiringIds.add(`gp-${doc.id}`));
    })();

    await Promise.all([...vPromises, mPromise, gPromise]);

    const count = expiringIds.size;

    return NextResponse.json({ success: true, count });
  } catch (e: any) {
    console.error('GET /api/maintenance/expiring-count error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}