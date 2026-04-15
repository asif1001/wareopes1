export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

function tsToISO(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (typeof v === 'string') return v;
    return null;
  } catch { return null; }
}

export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'edit'));
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing staff id' }, { status: 400 });

    const contentType = request.headers.get('content-type') || '';
    let raw: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      raw = Object.fromEntries(formData.entries());
    } else {
      raw = await request.json().catch(() => ({}));
    }

    const admin = await getAdmin();
    const adb = await getAdminDb();
    const docRef = adb.collection('staff').doc(id);
    const before = await docRef.get();
    if (!before.exists) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });

    const updatePayload: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const fields = [
      'type', 'fullName', 'status',
      'cprNo', 'contactNo', 'cprExpiry', 'visaExpiry', 'contractorCompanyName', 'assignedShiftId', 'assignedShiftName',
      'companyName', 'contactPersonName', 'contactPersonPhone', 'contactPersonEmail',
      'employeeId', 'designation', 'department', 'branch', 'phone', 'email',
      'nationality', 'contractStartDate', 'contractEndDate', 'currency', 'notes', 'imageUrl',
    ];
    for (const f of fields) {
      if (raw[f] != null) updatePayload[f] = raw[f] === '' ? null : String(raw[f]);
    }
    if (raw.ratePerHour != null) {
      updatePayload.ratePerHour = raw.ratePerHour === '' ? null : parseFloat(String(raw.ratePerHour));
    }

    const original = before.data() || {};
    const changed = Object.keys(updatePayload).filter(k => k !== 'updatedAt' && JSON.stringify((original as any)[k]) !== JSON.stringify(updatePayload[k]));
    if (changed.length > 0) {
      updatePayload.history = admin.firestore.FieldValue.arrayUnion({
        id: nanoid(),
        timestamp: admin.firestore.Timestamp.now(),
        userId: String(userId || 'system'),
        action: `Updated staff (${changed.join(', ')})`,
      });
    }

    await docRef.update(updatePayload);
    const snap = await docRef.get();
    const data = snap.data();
    return NextResponse.json({
      success: true,
      item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) },
    });
  } catch (e: any) {
    console.error('PUT /api/staff/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'delete'));
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing staff id' }, { status: 400 });

    const admin = await getAdmin();
    const adb = await getAdminDb();
    const docRef = adb.collection('staff').doc(id);
    if (!(await docRef.get()).exists) return NextResponse.json({ success: false, error: 'Staff not found' }, { status: 404 });

    await docRef.delete();
    try {
      await adb.collection('staff_audit').add({
        staffId: id, userId: String(userId || 'system'), action: 'Deleted staff record',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/staff/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
