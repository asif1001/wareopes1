export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getStorage } from 'firebase-admin/storage';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

function timestampToISO(ts: any): string | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    return null;
  } catch {
    return null;
  }
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
  if (!bucketName) throw new Error('No Storage bucket found for MHE update.');
  return storage.bucket(bucketName);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'edit'));
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing MHE id' }, { status: 400 });

    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    const adb = await getAdminDb();
    const admin = await getAdmin();

    const updatePayload: any = {
      ...(raw.equipmentInfo != null ? { equipmentInfo: String(raw.equipmentInfo) } : {}),
      ...(raw.status != null ? { status: String(raw.status) } : {}),
      ...(raw.serialNo != null ? { serialNo: String(raw.serialNo) } : {}),
      ...(raw.battery != null ? { battery: JSON.parse(String(raw.battery)) } : {}),
      ...(raw.certification != null ? { certification: JSON.parse(String(raw.certification)) } : {}),
      ...(raw.repairs != null ? { repairs: JSON.parse(String(raw.repairs)) } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const image = formData.get('image');
    const certAttachmentFile = formData.get('certAttachment') instanceof File ? (formData.get('certAttachment') as File) : null;
    const existingUrl = (raw as any).existingImageUrl as string | undefined;
    if (image && image instanceof File) {
      try {
        const bucket = await resolveBucket();
        const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `mhes/${id}/images/${Date.now()}-${nanoid()}-${safeName}`;
        const buffer = Buffer.from(await image.arrayBuffer());
        const downloadToken = nanoid();
        await bucket.file(storagePath).save(buffer, {
          metadata: {
            contentType: image.type || 'application/octet-stream',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
            cacheControl: 'public, max-age=31536000',
          },
          public: false,
        });
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
        updatePayload.imageUrl = fileUrl;
      } catch (err) {
        console.warn('MHE image upload (PUT) failed:', (err as any)?.message || err);
      }
    } else if (existingUrl) {
      updatePayload.imageUrl = existingUrl;
    }
    // Handle certificate attachment upload if provided
    if (certAttachmentFile) {
      try {
        const bucket = await resolveBucket();
        const safeName = certAttachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `mhes/${id}/certificates/${Date.now()}-${nanoid()}-${safeName}`;
        const buffer = Buffer.from(await certAttachmentFile.arrayBuffer());
        const downloadToken = nanoid();
        await bucket.file(storagePath).save(buffer, {
          metadata: {
            contentType: certAttachmentFile.type || 'application/octet-stream',
            metadata: { firebaseStorageDownloadTokens: downloadToken },
            cacheControl: 'public, max-age=31536000',
          },
          public: false,
        });
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
        const currentCert = raw.certification ? JSON.parse(String(raw.certification)) : {};
        updatePayload.certification = { ...(currentCert || {}), attachment: fileUrl };
      } catch (err) {
        console.warn('MHE cert attachment upload (PUT) failed:', (err as any)?.message || err);
      }
    }

    const beforeSnap = await adb.collection('mhes').doc(id).get();
    await adb.collection('mhes').doc(id).update(updatePayload);
    const snap = await adb.collection('mhes').doc(id).get();
    if (!snap.exists) return NextResponse.json({ success: false, error: 'MHE not found after update' }, { status: 404 });
    const data = snap.data() || {};

    try {
      const original = beforeSnap.data() || {};
      const changedFields: string[] = [];
      for (const k of Object.keys(updatePayload)) {
        if (k === 'updatedAt') continue;
        if (JSON.stringify((original as any)[k]) !== JSON.stringify((data as any)[k])) changedFields.push(k);
      }
      if (changedFields.length > 0) {
        await adb.collection('mhes').doc(id).update({
          history: [...(Array.isArray((data as any).history) ? (data as any).history : []), {
            id: nanoid(),
            timestamp: admin.firestore.Timestamp.now(),
            userId: String(userId || 'system'),
            action: `Updated MHE (${changedFields.join(', ')})`,
          }]
        });
      }
    } catch {}

    return NextResponse.json({ success: true, item: { id, ...data, createdAt: timestampToISO(data?.createdAt), updatedAt: timestampToISO(data?.updatedAt) } });
  } catch (e: any) {
    console.error('PUT /api/mhes/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'delete'));
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing MHE id' }, { status: 400 });

    const adb = await getAdminDb();
    const admin = await getAdmin();
    const docRef = adb.collection('mhes').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ success: false, error: 'MHE not found' }, { status: 404 });
    const data = snap.data() || {};

    // Try to delete image from storage if present
    try {
      const imageUrl: string | undefined = (data as any).imageUrl;
      if (imageUrl) {
        const m = imageUrl.match(/\/o\/([^?]+)/);
        const encodedPath = m?.[1];
        if (encodedPath) {
          const path = decodeURIComponent(encodedPath);
          const bucket = await (async () => { const storage = getStorage(); return storage.bucket(); })();
          await bucket.file(path).delete({ ignoreNotFound: true });
        }
      }
    } catch (err) {
      console.warn('Failed to delete MHE image:', (err as any)?.message || err);
    }

    await docRef.delete();

    try {
      await adb.collection('mhe_audit').add({
        id: nanoid(),
        mheId: id,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: String(userId || 'system'),
        action: 'Deleted MHE',
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/mhes/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}