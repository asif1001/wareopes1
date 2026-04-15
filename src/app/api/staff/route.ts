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

export async function GET(request: NextRequest) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const adb = await getAdminDb();
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const typeParam = url.searchParams.get('type');
    const limit = Math.max(1, Math.min(Number(limitParam || '100'), 300));

    let q: any = adb.collection('staff').orderBy('createdAt', 'desc');
    if (typeParam) q = q.where('type', '==', typeParam);
    q = q.limit(limit);

    const snap = await q.get();
    const items = snap.docs.map((d: any) => ({
      id: d.id,
      ...d.data(),
      createdAt: tsToISO(d.get('createdAt')),
      updatedAt: tsToISO(d.get('updatedAt')),
    }));
    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    console.error('GET /api/staff error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'staff', 'add'));
    if (!canAdd) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    let payload: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const raw = Object.fromEntries(formData.entries());
      const s = (k: string) => raw[k] ? String(raw[k]) : null;
      payload = {
        type: String(raw.type || 'Staff'),
        fullName: String(raw.fullName || ''),
        status: String(raw.status || 'Active'),
        // Staff-specific
        cprNo: s('cprNo'), contactNo: s('contactNo'), cprExpiry: s('cprExpiry'),
        visaExpiry: s('visaExpiry'), contractorCompanyName: s('contractorCompanyName'),
        assignedShiftId: s('assignedShiftId'), assignedShiftName: s('assignedShiftName'),
        // Contractor-specific
        companyName: s('companyName'), contactPersonName: s('contactPersonName'),
        contactPersonPhone: s('contactPersonPhone'), contactPersonEmail: s('contactPersonEmail'),
        // Common
        employeeId: s('employeeId'), designation: s('designation'), department: s('department'),
        branch: s('branch'), phone: s('phone'), email: s('email'), nationality: s('nationality'),
        contractStartDate: s('contractStartDate'), contractEndDate: s('contractEndDate'),
        notes: s('notes'), imageUrl: s('imageUrl'),
        ratePerHour: raw.ratePerHour ? parseFloat(String(raw.ratePerHour)) : null,
        currency: s('currency'),
      };
    } else {
      const body = await request.json().catch(() => ({}));
      const b = (k: string) => body[k] || null;
      payload = {
        type: String(body.type || 'Staff'),
        fullName: String(body.fullName || ''),
        status: String(body.status || 'Active'),
        cprNo: b('cprNo'), contactNo: b('contactNo'), cprExpiry: b('cprExpiry'),
        visaExpiry: b('visaExpiry'), contractorCompanyName: b('contractorCompanyName'),
        assignedShiftId: b('assignedShiftId'), assignedShiftName: b('assignedShiftName'),
        companyName: b('companyName'), contactPersonName: b('contactPersonName'),
        contactPersonPhone: b('contactPersonPhone'), contactPersonEmail: b('contactPersonEmail'),
        employeeId: b('employeeId'), designation: b('designation'), department: b('department'),
        branch: b('branch'), phone: b('phone'), email: b('email'), nationality: b('nationality'),
        contractStartDate: b('contractStartDate'), contractEndDate: b('contractEndDate'),
        notes: b('notes'), imageUrl: b('imageUrl'),
        ratePerHour: body.ratePerHour != null ? parseFloat(body.ratePerHour) : null,
        currency: b('currency'),
      };
    }

    if (!payload.fullName) return NextResponse.json({ success: false, error: 'fullName is required' }, { status: 400 });

    const admin = await getAdmin();
    const adb = await getAdminDb();
    const id = nanoid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();

    await adb.collection('staff').doc(id).set({
      ...payload,
      createdAt: now,
      updatedAt: now,
      history: [{ id: nanoid(), timestamp: nowTs, userId: String(userId || 'system'), action: 'Created staff record' }],
    });

    const snap = await adb.collection('staff').doc(id).get();
    const data = snap.data();
    return NextResponse.json({
      success: true,
      item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) },
    }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/staff error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
