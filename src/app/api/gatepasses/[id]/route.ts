export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getAdminDb, getAdmin } from '@/lib/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions';

function tsToISO(v: any): string | null { try { if (!v) return null; if (typeof v.toDate === 'function') return v.toDate().toISOString(); return null; } catch { return null; } }

async function deleteStorageByDownloadUrl(url: string) {
  try {
    const m = url.match(/\/o\/([^?]+)/);
    const encodedPath = m?.[1];
    if (!encodedPath) return;
    const path = decodeURIComponent(encodedPath);
    const storage = getStorage();
    const bucket = storage.bucket();
    await bucket.file(path).delete({ ignoreNotFound: true });
  } catch (e) { console.warn('delete storage by url failed', (e as any)?.message || e); }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'edit'));
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing gate pass id' }, { status: 400 });
    const admin = await getAdmin();
    const adb = await getAdminDb();

    const contentType = request.headers.get('content-type') || '';
    let updatePayload: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    let attachmentFile: File | null = null;
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const raw = Object.fromEntries(formData.entries());
      updatePayload = {
        ...updatePayload,
        ...(raw.passNumber != null ? { passNumber: String(raw.passNumber) } : {}),
        ...(raw.customerName != null ? { customerName: String(raw.customerName) } : {}),
        ...(raw.location != null ? { location: String(raw.location) } : {}),
        ...(raw.issueDate != null ? { issueDate: raw.issueDate } : {}),
        ...(raw.expiryDate != null ? { expiryDate: raw.expiryDate } : {}),
        ...(raw.status != null ? { status: String(raw.status) } : {}),
        ...(raw.attachments != null ? { attachments: JSON.parse(String(raw.attachments)) } : {}),
      };
      attachmentFile = formData.get('attachment') instanceof File ? (formData.get('attachment') as File) : null;
    } else {
      const body = await request.json().catch(() => ({}));
      updatePayload = {
        ...updatePayload,
        ...(body.passNumber != null ? { passNumber: String(body.passNumber) } : {}),
        ...(body.customerName != null ? { customerName: String(body.customerName) } : {}),
        ...(body.location != null ? { location: String(body.location) } : {}),
        ...(body.issueDate != null ? { issueDate: body.issueDate } : {}),
        ...(body.expiryDate != null ? { expiryDate: body.expiryDate } : {}),
        ...(body.status != null ? { status: String(body.status) } : {}),
        ...(body.attachments != null ? { attachments: Array.isArray(body.attachments) ? body.attachments : [] } : {}),
      };
    }

    const docRef = adb.collection('gatepasses').doc(id);
    const beforeSnap = await docRef.get();
    if (!beforeSnap.exists) return NextResponse.json({ success: false, error: 'Gate Pass not found' }, { status: 404 });
    const before = beforeSnap.data() || {};

    // If attachments changed, delete removed ones from storage
    if (updatePayload.attachments) {
      const prev: string[] = Array.isArray((before as any).attachments) ? (before as any).attachments : [];
      const next: string[] = updatePayload.attachments;
      const removed = prev.filter(u => !next.includes(u));
      await Promise.all(removed.map(deleteStorageByDownloadUrl));
    }

    // Upload new attachment and append to existing list if provided
    if (attachmentFile) {
      try {
        const storage = getStorage();
        const bucket = storage.bucket();
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
        const prev: string[] = Array.isArray((before as any).attachments) ? (before as any).attachments : [];
        updatePayload.attachments = Array.isArray(updatePayload.attachments) ? updatePayload.attachments : prev;
        updatePayload.attachments = [...updatePayload.attachments, fileUrl];
      } catch (err) {
        console.warn('Gate Pass attachment upload (PUT) failed:', (err as any)?.message || err);
      }
    }
    await docRef.update(updatePayload);
    const snap = await docRef.get();
    const data = snap.data() || {};

    try {
      const changed: string[] = [];
      for (const k of Object.keys(updatePayload)) {
        if (k === 'updatedAt') continue;
        if (JSON.stringify((before as any)[k]) !== JSON.stringify((data as any)[k])) changed.push(k);
      }
      if (changed.length > 0) {
        await docRef.update({
          history: [
            ...(
              Array.isArray((data as any).history)
                ? (data as any).history
                : []
            ),
            {
              id: nanoid(),
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              userId: String(userId || 'system'),
              action: `Updated Gate Pass (${changed.join(', ')})`,
            },
          ],
        });
      }
    } catch {}

    return NextResponse.json({ success: true, item: { id, ...data, createdAt: tsToISO(data?.createdAt), updatedAt: tsToISO(data?.updatedAt) } });
  } catch (e: any) {
    console.error('PUT /api/gatepasses/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions();
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'delete'));
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    const id = params.id;
    if (!id) return NextResponse.json({ success: false, error: 'Missing gate pass id' }, { status: 400 });
    const admin = await getAdmin();
    const adb = await getAdminDb();

    const docRef = adb.collection('gatepasses').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return NextResponse.json({ success: false, error: 'Gate Pass not found' }, { status: 404 });
    const data = snap.data() || {};

    // Delete attachments from storage
    try {
      const attachments: string[] = Array.isArray((data as any).attachments) ? (data as any).attachments : [];
      await Promise.all(attachments.map(deleteStorageByDownloadUrl));
    } catch (err) { console.warn('Gate Pass attachment cleanup failed:', (err as any)?.message || err); }

    await docRef.delete();
    try {
      await adb.collection('gatepass_audit').add({ id: nanoid(), gatePassId: id, timestamp: admin.firestore.FieldValue.serverTimestamp(), userId: String(userId || 'system'), action: 'Deleted Gate Pass' });
    } catch {}
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/gatepasses/[id] error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}