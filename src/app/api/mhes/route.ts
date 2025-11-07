export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getStorage } from 'firebase-admin/storage';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

function tsToISO(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    return null;
  } catch { return null; }
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
  let bucketName: string | undefined;
  for (const cand of candidates) {
    try {
      const b = storage.bucket(cand);
      const [exists] = await b.exists();
      if (exists) { bucketName = cand; break; }
    } catch (_) {}
  }
  if (!bucketName) throw new Error('No Storage bucket found for MHE create.');
  return storage.bucket(bucketName);
}

export async function GET() {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'));
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const adb = await getAdminDb();
    const snap = await adb.collection('mhes').orderBy('createdAt', 'desc').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: tsToISO(d.get('createdAt')), updatedAt: tsToISO(d.get('updatedAt')) }));
    return NextResponse.json({ success: true, items });
  } catch (e: any) {
    console.error('GET /api/mhes error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'add'));
    if (!canAdd) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    const admin = await getAdmin();
    const adb = await getAdminDb();

    let payload: any = {};
    let imageFile: File | null = null;
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const raw = Object.fromEntries(formData.entries());
      payload.equipmentInfo = String(raw.equipmentInfo || '');
      payload.status = String(raw.status || 'Active');
      payload.modelNo = raw.modelNo ? String(raw.modelNo) : null;
      payload.serialNo = raw.serialNo ? String(raw.serialNo) : null;
      payload.battery = raw.battery ? JSON.parse(String(raw.battery)) : null;
      payload.certification = raw.certification ? JSON.parse(String(raw.certification)) : null;
      payload.repairs = raw.repairs ? JSON.parse(String(raw.repairs)) : [];
      imageFile = formData.get('image') instanceof File ? (formData.get('image') as File) : null;
    } else {
      const body = await request.json().catch(() => ({}));
      payload.equipmentInfo = String(body.equipmentInfo || '');
      payload.status = String(body.status || 'Active');
      payload.modelNo = body.modelNo ? String(body.modelNo) : null;
      payload.serialNo = body.serialNo ? String(body.serialNo) : null;
      payload.battery = body.battery ?? null;
      payload.certification = body.certification ?? null;
      payload.repairs = Array.isArray(body.repairs) ? body.repairs : [];
    }

    if (!payload.equipmentInfo) return NextResponse.json({ success: false, error: 'equipmentInfo is required' }, { status: 400 });

    const id = nanoid();
    const docRef = adb.collection('mhes').doc(id);

    let imageUrl: string | null = null;
    if (imageFile) {
      try {
        const bucket = await resolveBucket();
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `mhes/${id}/images/${Date.now()}-${nanoid()}-${safeName}`;
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const downloadToken = nanoid();
        await bucket.file(storagePath).save(buffer, {
          metadata: {
            contentType: imageFile.type || 'application/octet-stream',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
            cacheControl: 'public, max-age=31536000',
          },
          public: false,
        });
        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      } catch (err) {
        console.warn('MHE image upload (POST) failed:', (err as any)?.message || err);
      }
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const nowTs = admin.firestore.Timestamp.now();
    await docRef.set({
      equipmentInfo: payload.equipmentInfo,
      status: payload.status,
      modelNo: payload.modelNo,
      serialNo: payload.serialNo,
      battery: payload.battery,
      certification: payload.certification,
      repairs: payload.repairs,
      imageUrl,
      createdAt: now,
      updatedAt: now,
      history: [{ id: nanoid(), timestamp: nowTs, userId: String(userId || 'system'), action: 'Created MHE' }],
    });
    const snap = await docRef.get();
    const data = snap.data();
    return NextResponse.json({ success: true, item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) } }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/mhes error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}