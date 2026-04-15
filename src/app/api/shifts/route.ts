export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

export async function GET() {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const adb = await getAdminDb();
    const snap = await adb.collection('shifts').orderBy('name', 'asc').get();
    const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'add'));
    if (!canAdd) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    if (!body.name?.trim()) return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

    const admin = await getAdmin();
    const adb = await getAdminDb();
    const id = body.id && body.id.startsWith('shift-') ? body.id : nanoid();

    await adb.collection('shifts').doc(id).set({
      name: String(body.name).trim(),
      startTime: String(body.startTime || '08:00'),
      endTime: String(body.endTime || '17:00'),
      workingDays: Array.isArray(body.workingDays) ? body.workingDays : [],
      notes: body.notes || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const snap = await adb.collection('shifts').doc(id).get();
    return NextResponse.json({ success: true, item: { id, ...snap.data() } }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
