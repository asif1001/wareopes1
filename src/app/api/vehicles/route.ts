export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

// Use Admin SDK to bypass client Firestore rules and ensure persistence
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';

// Convert Firestore/Admin Timestamp to ISO string if present
function timestampToISO(ts: any): string | null {
  try {
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
    return null;
  } catch {
    return null;
  }
}

// Resolve a working Storage bucket name similar to tasks API
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
    const { ok, role, permissions, branch } = await getCurrentUserPermissions();
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'));
    if (!canView) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const adb = await getAdminDb();

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const statusParam = url.searchParams.get('status');
    const branchParam = url.searchParams.get('branch');
    const cursorParam = url.searchParams.get('cursor'); // ISO date string
    const limit = Math.max(1, Math.min(Number(limitParam || '50'), 200));

    let q = adb.collection('vehicles').orderBy('createdAt', 'desc');
    // Branch scoping: non-admins are limited to their branch; admins can optionally filter
    const effectiveBranch = !isAdmin(role) ? (branch || undefined) : (branchParam || undefined);
    if (effectiveBranch) q = q.where('branch', '==', effectiveBranch);
    if (statusParam) q = q.where('status', '==', statusParam);
    if (cursorParam) {
      try {
        const admin = await getAdmin();
        const ts = admin.firestore.Timestamp.fromDate(new Date(cursorParam));
        q = q.startAfter(ts);
      } catch (_) { /* ignore bad cursor */ }
    }
    q = q.limit(limit);

    const snap = await q.get();
    const items = snap.docs.map((d: any) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: timestampToISO(data?.createdAt) || data?.createdAt || null,
        updatedAt: timestampToISO(data?.updatedAt) || data?.updatedAt || null,
      };
    });
    // Provide nextCursor for client-side pagination if needed
    const last = snap.docs[snap.docs.length - 1];
    const nextCursor = last ? timestampToISO(last.get('createdAt')) : null;
    return NextResponse.json({ success: true, items, nextCursor });
  } catch (e: any) {
    console.error('GET /api/vehicles error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'add'));
    if (!canAdd) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const formData = await request.formData();
    const raw = Object.fromEntries(formData.entries());

    // Basic validation: require core fields; driver assignment is optional
    const required = ['plateNo', 'vehicleType', 'branch', 'ownership'];
    const missing = required.filter((k) => !raw?.[k]);
    if (missing.length) {
      return NextResponse.json({ success: false, error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 });
    }

    const adb = await getAdminDb();
    const admin = await getAdmin();

    // Normalize numeric fields
    const num = (v: any) => (v === '' || v == null ? null : Number(v));

    const ownership = String(raw.ownership || 'Owned');
    const basePayload: any = {
      plateNo: String(raw.plateNo || ''),
      vehicleType: String(raw.vehicleType || ''),
      make: raw.make ? String(raw.make) : null,
      model: raw.model ? String(raw.model) : null,
      year: raw.year ? num(raw.year) : null,
      branch: String(raw.branch || ''),
      ownership,
      hireCompanyName: ownership === 'Hired' && raw.hireCompanyName ? String(raw.hireCompanyName) : null,
      contractStartDate: ownership === 'Hired' && raw.contractStartDate ? String(raw.contractStartDate) : null,
      contractEndDate: ownership === 'Hired' && raw.contractEndDate ? String(raw.contractEndDate) : null,
      driverName: String(raw.driverName || ''),
      driverEmployeeId: raw.driverEmployeeId ? String(raw.driverEmployeeId) : null,
      driverContact: raw.driverContact ? String(raw.driverContact) : null,
      lastOdometerReading: raw.lastOdometerReading ? num(raw.lastOdometerReading) : null,
      nextServiceDueKm: raw.nextServiceDueKm ? num(raw.nextServiceDueKm) : null,
      nextServiceDueDate: raw.nextServiceDueDate ? String(raw.nextServiceDueDate) : null,
      insuranceExpiry: raw.insuranceExpiry ? String(raw.insuranceExpiry) : null,
      registrationExpiry: raw.registrationExpiry ? String(raw.registrationExpiry) : null,
      fuelType: raw.fuelType ? String(raw.fuelType) : null,
      attachments: [],
      imageUrl: null,
      status: raw.status ? String(raw.status) : 'Active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: [{
        id: nanoid(),
        timestamp: admin.firestore.Timestamp.now(),
        userId: String(userId || 'system'),
        action: 'Created vehicle',
      }],
    };

    // Create document first to have a stable id for storage path
    const ref = await adb.collection('vehicles').add(basePayload);

    // Handle image upload if provided
    const image = formData.get('image');
    if (image && image instanceof File) {
      try {
        const bucket = await resolveBucket();
        const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `vehicles/${ref.id}/images/${Date.now()}-${nanoid()}-${safeName}`;
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
        await ref.update({ imageUrl: fileUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (err) {
        console.warn('Vehicle image upload failed:', (err as any)?.message || err);
      }
    }

  const snap = await ref.get();
  const data = snap.data() || {};
  try {
    const attachments = formData.getAll('attachments').filter((x) => x instanceof File) as File[];
    if (attachments.length > 0) {
      const bucket = await resolveBucket();
      const urls: string[] = [];
      for (const file of attachments) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `vehicles/${ref.id}/attachments/${Date.now()}-${nanoid()}-${safeName}`;
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
      await ref.update({ attachments: urls, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  } catch (_) {}
  const response = {
    id: ref.id,
    ...(await (await adb.collection('vehicles').doc(ref.id).get()).data()),
    createdAt: timestampToISO(data?.createdAt) || null,
    updatedAt: timestampToISO(data?.updatedAt) || null,
  };
  return NextResponse.json({ success: true, item: response }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/vehicles error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}
