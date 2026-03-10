import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function sanitizeFileName(name: string) {
  return name.replace(/[^A-Za-z0-9_.-]/g, '_');
}

function normalizePermissions(raw: any) {
  if (!raw) return undefined as any;
  if (typeof raw === 'object') return raw;
  return undefined as any;
}

async function authorize() {
  const { cookies } = await import('next/headers');
  const c = await cookies();
  const rawSession = c.get('session')?.value;
  let userId: string | null = null;
  if (rawSession) {
    try {
      const parsed = JSON.parse(rawSession);
      userId = typeof parsed?.id === 'string' ? parsed.id : rawSession;
    } catch {
      userId = rawSession;
    }
  }
  if (!userId) return { ok: false, reason: 'UNAUTHENTICATED' } as const;

  const { getAdminDb } = await import('@/lib/firebase/admin');
  const adb = await getAdminDb();

  const snap = await adb.collection('Users').doc(userId!).get();
  const udata = snap.exists ? (snap.data() as any) : {};
  const isAdmin = String(udata?.role || '').toLowerCase() === 'admin';

  let permissions = udata?.permissions as any | undefined;
  if (!permissions && udata?.role) {
    const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).get();
    if (!rolesSnap.empty) {
      const roleData = rolesSnap.docs[0].data() as any;
      const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
      const normalized: any = {};
      for (const item of arr) {
        if (typeof item !== 'string') continue;
        const [page, action] = item.split(':');
        if (!page || !action) continue;
        (normalized[page] ||= []).push(action);
      }
      permissions = Object.keys(normalized).length ? normalized : undefined;
    }
  }

  const canAdd = isAdmin || (Array.isArray(permissions?.production) && permissions.production.includes('add'));
  return { ok: canAdd, reason: canAdd ? undefined : 'FORBIDDEN', userId } as const;
}

export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason || 'FORBIDDEN' }, { status: auth.reason === 'UNAUTHENTICATED' ? 401 : 403 });
  }

  try {
    const form = await req.formData();
    const file = form.get('file');
    const shipmentId = String(form.get('shipmentId') || '');
    if (!file || typeof shipmentId !== 'string' || !shipmentId) {
      return NextResponse.json({ error: 'INVALID_FORM' }, { status: 400 });
    }
    // In Node runtime, the object may not be an instance of File; validate shape instead.
    const asAny = file as any;
    if (typeof asAny?.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'INVALID_FILE', message: 'No arrayBuffer() on uploaded file' }, { status: 400 });
    }

    if (typeof asAny.size === 'number' && asAny.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
    }

    const timestamp = Date.now();
    const originalName = (asAny.name as string) || 'upload.xlsx';
    const sanitizedName = sanitizeFileName(originalName);
    const fileName = `${timestamp}-${sanitizedName}`;
    const storagePath = `shipments/${String(shipmentId)}/production/${fileName}`;

    const { getStorage } = await import('firebase-admin/storage');
    const storage = getStorage();
    const envBucketRaw = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '');
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';
    const candidates: string[] = [];
    if (envBucketRaw) {
      const proj = envBucketRaw.split('.')[0];
      if (envBucketRaw.endsWith('.appspot.com')) {
        candidates.push(envBucketRaw);
        if (proj) candidates.push(`${proj}.firebasestorage.app`);
      } else if (envBucketRaw.endsWith('.firebasestorage.app')) {
        candidates.push(envBucketRaw);
        if (proj) candidates.push(`${proj}.appspot.com`);
      } else {
        candidates.push(`${envBucketRaw}.appspot.com`, `${envBucketRaw}.firebasestorage.app`);
      }
    } else if (projectId) {
      candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`);
    }

    let bucket = null as ReturnType<typeof storage.bucket> | null;
    for (const cand of candidates) {
      try {
        const b = storage.bucket(cand);
        const [exists] = await b.exists();
        if (exists) { bucket = b; break; }
      } catch (_) {}
    }
    if (!bucket) {
      // Fallback to default; may still work if configured in admin app.
      bucket = storage.bucket();
    }

    const buffer = Buffer.from(await asAny.arrayBuffer());
    const contentType = (asAny.type as string) || 'application/octet-stream';
    await bucket.file(storagePath).save(buffer, {
      contentType,
      metadata: {
        metadata: {
          shipmentId: String(shipmentId),
          uploaderId: String(auth.userId || ''),
        },
      },
      resumable: false,
      validation: false,
    });

    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;

    return NextResponse.json({ success: true, storagePath, downloadURL, fileName: originalName });
  } catch (e: any) {
    console.error('Server upload failed:', e);
    return NextResponse.json({ error: 'UPLOAD_FAILED', message: e?.message || 'Unknown error' }, { status: 500 });
  }
}