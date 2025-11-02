import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizePermissions(raw: any) {
  if (!raw) return undefined as any;
  if (typeof raw === 'object') return raw;
  return undefined as any;
}

async function authorize() {
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
  const canDelete = isAdmin || (Array.isArray(permissions?.production) && permissions.production.includes('delete'));
  return { ok: canAdd || canDelete, reason: canAdd || canDelete ? undefined : 'FORBIDDEN', userId, canAdd, canDelete } as const;
}

function sanitizeCaseNumber(s: any) {
  const str = String(s ?? '').trim();
  return str.replace(/[^-A-Za-z0-9_/\\]/g, '');
}

export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (!auth.ok || !auth.canAdd) {
    return NextResponse.json({ error: auth.reason || 'FORBIDDEN' }, { status: auth.reason === 'UNAUTHENTICATED' ? 401 : 403 });
  }

  try {
    const body = await req.json();
    const shipments: Record<string, {
      caseNumber: string;
      criticalParts: number;
      totalLines: number;
      domesticLines: number;
      bulkLines: number;
      row?: number;
    }[]> = body?.shipments || {};
    if (!shipments || typeof shipments !== 'object' || !Object.keys(shipments).length) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }
    const meta = body?.meta || {};

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const uploadsCol = adb.collection('FileUploads');
    const uploadRef = uploadsCol.doc();
    const startedAt = new Date();
    await uploadRef.set({
      status: 'started',
      startedAt,
      userId: auth.userId,
      meta,
      shipments: Object.keys(shipments),
    });

    let totalItems = 0;
    const maxBatchWrites = 500; // Firestore limit
    const maxProcessingMs = 45000; // extend guard to accommodate BulkWriter throughput

    // Prefer BulkWriter to reduce latency and retry throttled writes automatically
    // Fall back to batched writes if BulkWriter is unavailable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bulkWriter: any = (adb as any).bulkWriter ? (adb as any).bulkWriter() : null;

    for (const [shipmentId, recs] of Object.entries(shipments)) {
      if (!shipmentId || !Array.isArray(recs)) continue;
      const shipmentRef = adb.collection('shipments').doc(String(shipmentId));
      const casesCol = shipmentRef.collection('ProductionCases');

      if (bulkWriter) {
        for (const r of recs) {
          const caseNumber = sanitizeCaseNumber(r.caseNumber);
          const cp = Number(r.criticalParts);
          const tl = Number(r.totalLines);
          const dl = Number(r.domesticLines);
          const bl = Number(r.bulkLines);
          if (!caseNumber) continue;
          if ([cp, tl, dl, bl].some((n) => !Number.isFinite(n) || n < 0)) continue;
          const docRef = casesCol.doc(caseNumber);
          bulkWriter.set(docRef, {
            caseNumber,
            criticalParts: cp,
            totalLines: tl,
            domesticLines: dl,
            bulkLines: bl,
            uploadedAt: new Date(),
            uploadedBy: auth.userId,
            sourceRow: Number.isFinite(Number((r as any).row)) ? Number((r as any).row) : undefined,
          });
          totalItems++;
        }
      } else {
        // chunk records to avoid batch size limits
        for (let i = 0; i < recs.length; i += maxBatchWrites - 5) { // keep headroom
          const batch = adb.batch();
          const slice = recs.slice(i, i + (maxBatchWrites - 5));
          for (const r of slice) {
            const caseNumber = sanitizeCaseNumber(r.caseNumber);
            const cp = Number(r.criticalParts);
            const tl = Number(r.totalLines);
            const dl = Number(r.domesticLines);
            const bl = Number(r.bulkLines);
            if (!caseNumber) continue;
            if ([cp, tl, dl, bl].some((n) => !Number.isFinite(n) || n < 0)) continue;
            const docRef = casesCol.doc(caseNumber);
            batch.set(docRef, {
              caseNumber,
              criticalParts: cp,
              totalLines: tl,
              domesticLines: dl,
              bulkLines: bl,
              uploadedAt: new Date(),
              uploadedBy: auth.userId,
              sourceRow: Number.isFinite(Number((r as any).row)) ? Number((r as any).row) : undefined,
            });
            totalItems++;
          }
          await batch.commit();
        }
      }
      // update shipment timestamp separately
      // update shipment lock and timestamp
      await shipmentRef.set({ productionUploaded: true, updatedAt: new Date() }, { merge: true });
      // write meta for efficient deletion and downstream reads (case number list)
      const dedup = Array.from(new Set(recs.map((r) => sanitizeCaseNumber(r.caseNumber)).filter(Boolean)));
      const metaRef = shipmentRef.collection('ProductionMeta').doc('last');
      await metaRef.set({
        caseNumbers: dedup,
        count: dedup.length,
        uploadedAt: new Date(),
        uploadedBy: auth.userId,
        fileName: meta?.fileName || undefined,
        fileUrl: meta?.fileUrl || undefined,
        storagePath: meta?.storagePath || undefined,
      }, { merge: true });
      if (Date.now() - startedAt.getTime() > maxProcessingMs) {
        break;
      }
    }

    if (bulkWriter) {
      await bulkWriter.close();
    }

    const finishedAt = new Date();
    await uploadRef.update({
      status: Date.now() - startedAt.getTime() > maxProcessingMs ? 'timeout' : 'completed',
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      processedCount: totalItems,
    });

    return NextResponse.json({ success: true, totalItems, status: 'ok' });
  } catch (e: any) {
    try {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const adb = await getAdminDb();
      await adb.collection('FileUploads').add({
        status: 'failed',
        error: e?.message || String(e),
        at: new Date(),
      });
    } catch {}
    return NextResponse.json({ error: 'SERVER_ERROR', message: e?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorize();
  if (!auth.ok || !auth.canDelete) {
    return NextResponse.json({ error: auth.reason || 'FORBIDDEN' }, { status: auth.reason === 'UNAUTHENTICATED' ? 401 : 403 });
  }

  try {
    const body = await req.json();
    const shipments: Record<string, string[]> = body?.shipments || {};
    if (!shipments || typeof shipments !== 'object' || !Object.keys(shipments).length) {
      return NextResponse.json({ error: 'INVALID_PAYLOAD' }, { status: 400 });
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    let totalDeletes = 0;
    const maxBatchOps = 500; // Firestore limit

    for (const [shipmentId, caseNumbers] of Object.entries(shipments)) {
      if (!shipmentId || !Array.isArray(caseNumbers) || !caseNumbers.length) continue;
      const shipmentRef = adb.collection('shipments').doc(String(shipmentId));
      const casesCol = shipmentRef.collection('ProductionCases');

      let targets = caseNumbers.map((c) => sanitizeCaseNumber(c)).filter(Boolean);
      // wildcard '*' means delete all from meta doc without scanning subcollection
      if (targets.length === 1 && targets[0] === '*') {
        const metaRef = shipmentRef.collection('ProductionMeta').doc('last');
        const metaSnap = await metaRef.get();
        const metaData = metaSnap.exists ? (metaSnap.data() as any) : {};
        const list = Array.isArray(metaData?.caseNumbers) ? metaData.caseNumbers : [];
        targets = list.map((c: any) => sanitizeCaseNumber(c)).filter(Boolean);
        // also delete the original uploaded file if tracked
        const storagePath = String(metaData?.storagePath || '');
        if (storagePath) {
          try {
            const { getStorage } = await import('firebase-admin/storage');
            const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;
            const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
            await bucket.file(storagePath).delete();
          } catch (err) {
            // Non-fatal; continue deleting Firestore docs
            console.warn('Failed to delete storage file for shipment', shipmentId, err);
          }
        }
      }

      // chunk deletes to respect batch limits
      for (let i = 0; i < targets.length; i += maxBatchOps) {
        const batch = adb.batch();
        const slice = targets.slice(i, i + maxBatchOps);
        for (const c of slice) {
          const id = sanitizeCaseNumber(c);
          if (!id) continue;
          const docRef = casesCol.doc(id);
          batch.delete(docRef);
          totalDeletes++;
        }
        await batch.commit();
      }
      // clear lock and meta
      await shipmentRef.set({ productionUploaded: false, updatedAt: new Date() }, { merge: true });
      const metaRef = shipmentRef.collection('ProductionMeta').doc('last');
      await metaRef.delete();
    }

    return NextResponse.json({ success: true, totalDeletes, status: 'ok' });
  } catch (e: any) {
    return NextResponse.json({ error: 'SERVER_ERROR', message: e?.message || 'Unknown error' }, { status: 500 });
  }
}