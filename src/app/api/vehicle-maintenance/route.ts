export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';
import { getStorage } from 'firebase-admin/storage';

function tsToISO(v: any): string | null {
  try { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate().toISOString(); return null; } catch { return null; }
}

async function resolveBucket() {
  const storage = getStorage();
  const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
  const candidates: string[] = [];
  if (envBucket) {
    const proj = envBucket.split('.')[0];
    if (envBucket.endsWith('.appspot.com')) {
      candidates.push(envBucket);
      if (proj) candidates.push(`${proj}.firebasestorage.app`);
    } else if (envBucket.endsWith('.firebasestorage.app')) {
      candidates.push(envBucket);
      if (proj) candidates.push(`${proj}.appspot.com`);
    } else {
      candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`);
    }
  } else if (projectId) {
    candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
  }
  for (const cand of candidates) {
    try {
      const b = storage.bucket(cand);
      const [exists] = await b.exists();
      if (exists) return b;
    } catch (_) {}
  }
  return storage.bucket();
}

export async function GET(request: NextRequest) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const adb = await getAdminDb();

    const url = new URL(request.url);
    const vehicleId = url.searchParams.get('vehicleId');
    const limitParam = url.searchParams.get('limit');
    const cursorParam = url.searchParams.get('cursor');
    const limit = Math.max(1, Math.min(Number(limitParam || '50'), 200));

    let q = adb.collection('vehicle_maintenance').orderBy('createdAt', 'desc');
    if (vehicleId) q = q.where('vehicleId', '==', vehicleId);
    if (cursorParam) {
      try {
        const admin = await getAdmin();
        const ts = admin.firestore.Timestamp.fromDate(new Date(cursorParam));
        q = q.startAfter(ts);
      } catch (_) { /* ignore bad cursor */ }
    }
    q = q.limit(limit);
    const snap = await q.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToISO(d.get('createdAt')), updatedAt: tsToISO(d.get('updatedAt')) }));
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? tsToISO(last.get('createdAt')) : null;
    return NextResponse.json({ success: true, items, nextCursor });
  } catch (e: any) {
    console.error('GET /api/vehicle-maintenance error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'add'));
    if (!canAdd) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const admin = await getAdmin();
    const adb = await getAdminDb();

    const contentType = request.headers.get('content-type') || '';
    let payload: any = {};
    let attachmentFile: File | null = null;
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const raw = Object.fromEntries(formData.entries());
      payload.vehicleId = String(raw.vehicleId || '');
      payload.date = raw.date || null;
      payload.type = String(raw.type || '');
      payload.reportedBy = raw.reportedBy ? String(raw.reportedBy) : null;
      payload.workDescription = String(raw.workDescription || '');
      payload.vendor = raw.vendor ? String(raw.vendor) : null;
      payload.cost = raw.cost != null ? Number(raw.cost) : null;
      payload.invoiceNumber = raw.invoiceNumber ? String(raw.invoiceNumber) : null;
      payload.nextServiceDueKm = raw.nextServiceDueKm != null ? Number(raw.nextServiceDueKm) : null;
      payload.nextServiceDueDate = raw.nextServiceDueDate || null;
      payload.remarks = raw.remarks ? String(raw.remarks) : null;
      attachmentFile = formData.get('attachment') instanceof File ? (formData.get('attachment') as File) : null;
    } else {
      const body = await request.json().catch(() => ({}));
      payload.vehicleId = String(body.vehicleId || '');
      payload.date = body.date || null;
      payload.type = String(body.type || '');
      payload.reportedBy = body.reportedBy ? String(body.reportedBy) : null;
      payload.workDescription = String(body.workDescription || '');
      payload.vendor = body.vendor ? String(body.vendor) : null;
      payload.cost = body.cost != null ? Number(body.cost) : null;
      payload.invoiceNumber = body.invoiceNumber ? String(body.invoiceNumber) : null;
      payload.nextServiceDueKm = body.nextServiceDueKm != null ? Number(body.nextServiceDueKm) : null;
      payload.nextServiceDueDate = body.nextServiceDueDate || null;
      payload.remarks = body.remarks ? String(body.remarks) : null;
    }

    if (!payload.vehicleId || !payload.date || !payload.type || !payload.workDescription) {
      return NextResponse.json({ success: false, error: 'vehicleId, date, type, and workDescription are required' }, { status: 400 });
    }

    const id = nanoid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();
    const docRef = adb.collection('vehicle_maintenance').doc(id);
    await docRef.set({
      vehicleId: payload.vehicleId,
      date: payload.date,
      type: payload.type,
      reportedBy: payload.reportedBy || null,
      workDescription: payload.workDescription,
      vendor: payload.vendor || null,
      cost: payload.cost ?? null,
      invoiceNumber: payload.invoiceNumber ?? null,
      nextServiceDueKm: payload.nextServiceDueKm ?? null,
      nextServiceDueDate: payload.nextServiceDueDate ?? null,
      remarks: payload.remarks ?? null,
      attachmentUrl: null,
      createdAt: now,
      updatedAt: now,
      history: [{ id: nanoid(), timestamp: nowTs, userId: String(userId || 'system'), action: 'Created Maintenance' }],
    });

    if (attachmentFile) {
      try {
        const bucket = await resolveBucket();
        const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `vehicle-maintenance/${id}/attachments/${Date.now()}-${nanoid()}-${safeName}`;
        const buffer = Buffer.from(await attachmentFile.arrayBuffer());
        const downloadToken = nanoid();
        await bucket.file(storagePath).save(buffer, {
          metadata: {
            contentType: attachmentFile.type || 'application/octet-stream',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
            cacheControl: 'public, max-age=31536000',
          },
          public: false,
        });
        const encodedPath = encodeURIComponent(storagePath);
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
        await docRef.update({ attachmentUrl: fileUrl, updatedAt: now });
      } catch (err) {
        console.warn('Vehicle Maintenance attachment upload failed:', (err as any)?.message || err);
      }
    }

    const snap = await docRef.get();
    const data = snap.data();
    return NextResponse.json({ success: true, item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) } }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/vehicle-maintenance error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}