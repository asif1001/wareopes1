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
  for (const cand of candidates) {
    try {
      const b = storage.bucket(cand);
      const [exists] = await b.exists();
      if (exists) return b;
    } catch (_) {}
  }
  return storage.bucket();
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'edit'));
    if (!canEdit) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const id = params.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing vehicle id' }, { status: 400 });
    }
    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());
    const adb = await getAdminDb();
    const admin = await getAdmin();

    const num = (v: any) => (v === '' || v == null ? null : Number(v));
    const updatePayload: any = {
      ...(raw.plateNo != null ? { plateNo: String(raw.plateNo) } : {}),
      ...(raw.vehicleType != null ? { vehicleType: String(raw.vehicleType) } : {}),
      ...(raw.make != null ? { make: String(raw.make) } : {}),
      ...(raw.model != null ? { model: String(raw.model) } : {}),
      ...(raw.year != null ? { year: num(raw.year) } : {}),
      ...(raw.branch != null ? { branch: String(raw.branch) } : {}),
      ...(raw.ownership != null ? { ownership: String(raw.ownership) } : {}),
      ...(raw.hireCompanyName != null ? { hireCompanyName: String(raw.hireCompanyName) } : {}),
      ...(raw.driverName != null ? { driverName: String(raw.driverName) } : {}),
      ...(raw.driverEmployeeId != null ? { driverEmployeeId: String(raw.driverEmployeeId) } : {}),
      ...(raw.driverContact != null ? { driverContact: String(raw.driverContact) } : {}),
      ...(raw.lastOdometerReading != null ? { lastOdometerReading: num(raw.lastOdometerReading) } : {}),
      ...(raw.nextServiceDueKm != null ? { nextServiceDueKm: num(raw.nextServiceDueKm) } : {}),
      ...(raw.nextServiceDueDate != null ? { nextServiceDueDate: String(raw.nextServiceDueDate) } : {}),
      ...(raw.insuranceExpiry != null ? { insuranceExpiry: String(raw.insuranceExpiry) } : {}),
      ...(raw.registrationExpiry != null ? { registrationExpiry: String(raw.registrationExpiry) } : {}),
      ...(raw.fuelType != null ? { fuelType: String(raw.fuelType) } : {}),
      ...(raw.status != null ? { status: String(raw.status) } : {}),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Image handling
    const image = formData.get('image');
    const existingUrl = (raw as any).existingImageUrl as string | undefined;
    if (image && image instanceof File) {
      try {
        const bucket = await resolveBucket();
        const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `vehicles/${id}/images/${Date.now()}-${nanoid()}-${safeName}`;
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
        const encodedPath = encodeURIComponent(storagePath);
        const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
        updatePayload.imageUrl = fileUrl;
      } catch (err) {
        console.warn('Vehicle image upload (PUT) failed:', (err as any)?.message || err);
      }
    } else if (existingUrl) {
      updatePayload.imageUrl = existingUrl;
    }

    const docRef = adb.collection('vehicles').doc(id);
    const beforeSnap = await docRef.get();
    const attachFiles = formData.getAll('attachments').filter(x => x instanceof File) as File[];
    if (attachFiles.length > 0) {
      try {
        const bucket = await resolveBucket();
        const urls: string[] = [];
        for (const file of attachFiles) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `vehicles/${id}/attachments/${Date.now()}-${nanoid()}-${safeName}`;
          const buffer = Buffer.from(await file.arrayBuffer());
          const downloadToken = nanoid();
          await bucket.file(storagePath).save(buffer, {
            metadata: {
              contentType: file.type || 'application/octet-stream',
              metadata: { firebaseStorageDownloadTokens: downloadToken },
              cacheControl: 'public, max-age=31536000',
            },
            public: false,
          });
          const encodedPath = encodeURIComponent(storagePath);
          const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
          urls.push(fileUrl);
        }
      const prev = Array.isArray((beforeSnap.data() as any)?.attachments) ? ((beforeSnap.data() as any).attachments as string[]) : [];
      updatePayload.attachments = [...prev, ...urls];
    } catch (_) {}
    }
    try {
      const urlsRaw = (raw as any).attachmentsUrls as string | undefined;
      if (urlsRaw) {
        const urls: string[] = JSON.parse(urlsRaw);
        const prev = Array.isArray((beforeSnap.data() as any)?.attachments) ? ((beforeSnap.data() as any).attachments as string[]) : [];
        updatePayload.attachments = [...prev, ...urls];
      }
    } catch (_) {}
    try {
      const removeRaw = (raw as any).removeAttachmentsUrls as string | undefined;
      if (removeRaw) {
        const removeUrls: string[] = JSON.parse(removeRaw);
        const prev = Array.isArray((beforeSnap.data() as any)?.attachments) ? ((beforeSnap.data() as any).attachments as string[]) : [];
        const next = prev.filter((u) => !removeUrls.includes(String(u)));
        updatePayload.attachments = next;
        try {
          const bucket = await resolveBucket();
          for (const url of removeUrls) {
            const m = String(url).match(/\/o\/([^?]+)/);
            const encodedPath = m?.[1];
            if (encodedPath) {
              const path = decodeURIComponent(encodedPath);
              await bucket.file(path).delete({ ignoreNotFound: true });
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    // Prepare history entry in a single atomic update
    try {
      const original = beforeSnap.data() || {};
      const changedFields: string[] = [];
      for (const k of Object.keys(updatePayload)) {
        if (k === 'updatedAt') continue;
        if (JSON.stringify((original as any)[k]) !== JSON.stringify((updatePayload as any)[k])) changedFields.push(k);
      }
      if (changedFields.length > 0) {
        updatePayload.history = admin.firestore.FieldValue.arrayUnion({
          id: nanoid(),
          timestamp: admin.firestore.Timestamp.now(),
          userId: String(userId || 'system'),
          action: `Updated vehicle (${changedFields.join(', ')})`,
        });
      }
    } catch (_) {}

    await docRef.update(updatePayload);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Vehicle not found after update' }, { status: 404 });
    }
    const data = snap.data() || {};
    
    return NextResponse.json({
      success: true,
      item: {
        id,
        ...data,
        createdAt: timestampToISO(data?.createdAt) || null,
        updatedAt: timestampToISO(data?.updatedAt) || null,
      }
    });
  } catch (e: any) {
    console.error('PUT /api/vehicles/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'delete'));
    if (!canDelete) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing vehicle id' }, { status: 400 });

    const adb = await getAdminDb();
    const admin = await getAdmin();
    const docRef = adb.collection('vehicles').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
    const data = snap.data() || {};

    // Try to delete image from storage if present
    try {
      const imageUrl: string | undefined = (data as any).imageUrl;
      if (imageUrl) {
        const m = imageUrl.match(/\/o\/([^?]+)/);
        const encodedPath = m?.[1];
        if (encodedPath) {
          const path = decodeURIComponent(encodedPath);
          const bucket = await (async () => {
            const storage = getStorage();
            return storage.bucket();
          })();
          await bucket.file(path).delete({ ignoreNotFound: true });
        }
      }
    } catch (err) {
      console.warn('Failed to delete vehicle image:', (err as any)?.message || err);
    }

    await docRef.delete();

    // Log deletion event (best-effort, though document is deleted)
    try {
      await adb.collection('vehicle_audit').add({
        id: nanoid(),
        vehicleId: id,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        userId: String(userId || 'system'),
        action: 'Deleted vehicle',
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/vehicles/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}