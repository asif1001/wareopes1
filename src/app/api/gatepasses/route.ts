export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';
import { getStorage } from 'firebase-admin/storage';

function tsToISO(v: any): string | null {
  try { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate().toISOString(); return null; } catch { return null; }
}

// Resolve a working Storage bucket similar to vehicles API
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
  // Fallback to default bucket if candidates resolution fails
  return storage.bucket();
}

export async function GET() {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const adb = await getAdminDb();
    const snap = await adb.collection('gatepasses').orderBy('createdAt', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToISO(d.get('createdAt')), updatedAt: tsToISO(d.get('updatedAt')) }));
    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    console.error('GET /api/gatepasses error:', e);
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
      payload.passNumber = String(raw.passNumber || '');
      payload.customerName = String(raw.customerName || '');
      payload.location = String(raw.location || '');
      payload.issueDate = raw.issueDate || null;
      payload.expiryDate = raw.expiryDate || null;
      payload.status = String(raw.status || 'Active');
      payload.vehicleId = raw.vehicleId ? String(raw.vehicleId) : null;
      payload.driverName = raw.driverName ? String(raw.driverName) : null;
      attachmentFile = formData.get('attachment') instanceof File ? (formData.get('attachment') as File) : null;
      // Allow pre-supplied attachment URLs
      payload.attachments = raw.attachments ? JSON.parse(String(raw.attachments)) : [];
    } else {
      const body = await request.json().catch(() => ({}));
      payload.passNumber = String(body.passNumber || '');
      payload.customerName = String(body.customerName || '');
      payload.location = String(body.location || '');
      payload.issueDate = body.issueDate || null;
      payload.expiryDate = body.expiryDate || null;
      payload.status = String(body.status || 'Active');
      payload.vehicleId = body.vehicleId ? String(body.vehicleId) : null;
      payload.driverName = body.driverName ? String(body.driverName) : null;
      payload.attachments = Array.isArray(body.attachments) ? body.attachments : [];
    }

    if (!payload.passNumber || !payload.customerName) {
      return NextResponse.json({ success: false, error: 'passNumber and customerName are required' }, { status: 400 });
    }

    // Create doc first to have id for storage path
    const id = nanoid();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();
    const docRef = adb.collection('gatepasses').doc(id);
    await docRef.set({
      passNumber: payload.passNumber,
      customerName: payload.customerName,
      location: payload.location,
      issueDate: payload.issueDate,
      expiryDate: payload.expiryDate,
      status: payload.status,
      vehicleId: payload.vehicleId || null,
      driverName: payload.driverName || null,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      createdAt: now,
      updatedAt: now,
      history: [{ id: nanoid(), timestamp: nowTs, userId: String(userId || 'system'), action: 'Created Gate Pass' }],
    });

    // Handle attachment upload via Admin Storage if provided
    if (attachmentFile) {
      try {
        const bucket = await resolveBucket();
        const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `gatepasses/${id}/attachments/${Date.now()}-${nanoid()}-${safeName}`;
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
        await docRef.update({ attachments: [fileUrl], updatedAt: now });
      } catch (err) {
        console.warn('Gate Pass attachment upload failed:', (err as any)?.message || err);
      }
    }

    const snap = await docRef.get();
    const data = snap.data();
    return NextResponse.json({ success: true, item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) } }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/gatepasses error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}