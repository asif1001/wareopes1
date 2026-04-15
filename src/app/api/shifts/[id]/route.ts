export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

export async function DELETE(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'delete'));
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const adb = await getAdminDb();
    await adb.collection('shifts').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'edit'));
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const admin = await getAdmin();
    const adb = await getAdminDb();

    await adb.collection('shifts').doc(id).update({
      name: String(body.name || '').trim(),
      startTime: String(body.startTime || '08:00'),
      endTime: String(body.endTime || '17:00'),
      workingDays: Array.isArray(body.workingDays) ? body.workingDays : [],
      notes: body.notes || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const snap = await adb.collection('shifts').doc(id).get();
    return NextResponse.json({ success: true, item: { id, ...snap.data() } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
