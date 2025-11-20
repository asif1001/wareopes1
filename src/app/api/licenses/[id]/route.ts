export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { getStorage } from 'firebase-admin/storage'
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions'
import { getAdminDb, getAdmin } from '@/lib/firebase/admin'

function timestampToISO(ts: any): string | null {
  try {
    if (!ts) return null
    if (typeof ts.toDate === 'function') return ts.toDate().toISOString()
    return null
  } catch {
    return null
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions()
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'edit'))
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    const admin = await getAdmin()
    const ct = request.headers.get('content-type') || ''
    const ref = adb.collection('licenses').doc(params.id)
    if (ct.includes('multipart/form-data')) {
      const formData = await request.formData()
      const raw = Object.fromEntries(formData.entries())
      const update: any = {
        ...(raw.driverId != null ? { driverId: String(raw.driverId) } : {}),
        ...(raw.vehicleType != null ? { vehicleType: String(raw.vehicleType) } : {}),
        ...(raw.licenseNumber != null ? { licenseNumber: String(raw.licenseNumber) } : {}),
        ...(raw.issueDate != null ? { issueDate: String(raw.issueDate) } : {}),
        ...(raw.expiryDate != null ? { expiryDate: String(raw.expiryDate) } : {}),
        ...(raw.remarks != null ? { remarks: String(raw.remarks) } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      const before = await ref.get()
      const filesRaw = formData.getAll('attachments')
      const files = (filesRaw as any[]).filter(x => x && typeof x.arrayBuffer === 'function') as any[]
      let addedCount = 0
      if (files.length) {
        try {
          const storage = getStorage()
          const bucket = storage.bucket()
          const urls: string[] = []
          for (const file of files) {
            const name = String((file as any).name || 'file')
            const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `licenses/${params.id}/attachments/${Date.now()}-${nanoid()}-${safe}`
            const buffer = Buffer.from(await file.arrayBuffer())
            const downloadToken = nanoid()
            await bucket.file(storagePath).save(buffer, {
              metadata: { contentType: file.type || 'application/octet-stream', metadata: { firebaseStorageDownloadTokens: downloadToken }, cacheControl: 'public, max-age=31536000' },
              public: false,
            })
            const encoded = encodeURIComponent(storagePath)
            const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${downloadToken}`
            urls.push(url)
          }
          const prev = Array.isArray((before.data() as any)?.attachments) ? ((before.data() as any).attachments as string[]) : []
          update.attachments = [...prev, ...urls]
          update.attachmentUrl = (update.attachments[0] || prev[0] || null)
          addedCount += urls.length
        } catch (e) {
          console.error('PUT /api/licenses upload error:', e)
        }
      }
      const urlsRaw = (raw as any).attachmentsUrls as string | undefined
      if (urlsRaw) {
        try {
          const urls: string[] = JSON.parse(urlsRaw)
          const prev = Array.isArray((before.data() as any)?.attachments) ? ((before.data() as any).attachments as string[]) : []
          update.attachments = [...prev, ...urls]
          update.attachmentUrl = (update.attachments[0] || prev[0] || null)
          addedCount += urls.length
        } catch (e) {
          console.error('PUT /api/licenses attachmentsUrls parse error:', e)
        }
      }
      const prevHistory = Array.isArray((before.data() as any)?.history) ? ((before.data() as any).history as any[]) : []
      const historyEntry = { id: nanoid(), timestamp: admin.firestore.Timestamp.now(), userId: String(userId || 'system'), action: addedCount > 0 ? `Updated license (added attachments: ${addedCount})` : 'Updated license' }
      update.history = [...prevHistory, historyEntry]
      await ref.update(update)
      const snap = await ref.get()
      const data = snap.data() || {}
      const item = { id: params.id, ...data, createdAt: timestampToISO(data?.createdAt) || null, updatedAt: timestampToISO(data?.updatedAt) || null }
      return NextResponse.json({ success: true, item })
    } else {
      const body = await request.json()
      await ref.update({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
      const snap = await ref.get()
      const data = snap.data() || {}
      const item = { id: params.id, ...data, createdAt: timestampToISO(data?.createdAt) || null, updatedAt: timestampToISO(data?.updatedAt) || null }
      return NextResponse.json({ success: true, item })
    }
  } catch (e: any) {
    console.error('PUT /api/licenses/[id] error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'delete'))
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    await adb.collection('licenses').doc(params.id).delete()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/licenses/[id] error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
