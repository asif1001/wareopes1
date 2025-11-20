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
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'licenses', 'edit') || hasPermission(permissions, 'maintenance', 'edit'))
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    const admin = await getAdmin()
    const ct = request.headers.get('content-type') || ''
    const ref = adb.collection('licenses').doc(params.id)
    async function resolveBucket() {
      const storage = getStorage()
      const envBucket = (process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '').replace(/^gs:\/\//, '')
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ''
      const candidates: string[] = []
      if (envBucket) {
        const proj = envBucket.split('.')[0]
        if (envBucket.endsWith('.appspot.com')) {
          candidates.push(envBucket)
          if (proj) candidates.push(`${proj}.firebasestorage.app`)
        } else if (envBucket.endsWith('.firebasestorage.app')) {
          candidates.push(envBucket)
          if (proj) candidates.push(`${proj}.appspot.com`)
        } else {
          candidates.push(`${envBucket}.appspot.com`, `${envBucket}.firebasestorage.app`)
        }
      } else if (projectId) {
        candidates.push(`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`)
      }
      for (const cand of candidates) {
        try {
          const b = storage.bucket(cand)
          const [exists] = await b.exists()
          if (exists) return b
        } catch {}
      }
      return storage.bucket()
    }
    if (ct.includes('multipart/form-data')) {
      const formData = await request.formData()
      const raw = Object.fromEntries(formData.entries())
      const update: any = {
        ...(raw.driverId != null ? { driverId: String(raw.driverId) } : {}),
        ...(raw.vehicleType != null ? { vehicleType: String(raw.vehicleType) } : {}),
        ...(raw.licenseNumber != null ? { licenseNumber: String(raw.licenseNumber) } : {}),
        ...(raw.issueDate != null ? { issueDate: String(raw.issueDate) } : {}),
        ...(raw.expiryDate != null ? { expiryDate: String(raw.expiryDate) } : {}),
        ...(raw.branch != null ? { branch: String(raw.branch) } : {}),
        ...(raw.remarks != null ? { remarks: String(raw.remarks) } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }
      const before = await ref.get()
      const filesRaw = formData.getAll('attachments')
      const files = (filesRaw as any[]).filter(x => x && typeof x.arrayBuffer === 'function') as any[]
      let addedCount = 0
      if (files.length) {
        try {
          const bucket = await resolveBucket()
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
      const removeRaw = (raw as any).removeAttachmentsUrls as string | undefined
      let removedCount = 0
      if (removeRaw) {
        try {
          const urls: string[] = JSON.parse(removeRaw)
          const prev = Array.isArray((before.data() as any)?.attachments) ? ((before.data() as any).attachments as string[]) : []
          const next = prev.filter(u => !urls.includes(u))
          update.attachments = next
          update.attachmentUrl = next[0] || null
          removedCount = urls.length
          try {
            for (const u of urls) {
              const m = String(u).match(/\/v0\/b\/([^/]+)\/o\/([^?]+)/)
              const bucketName = m?.[1]
              const encPath = m?.[2]
              const path = encPath ? decodeURIComponent(encPath) : ''
              if (bucketName && path) {
                const b = getStorage().bucket(bucketName)
                await b.file(path).delete({ ignoreNotFound: true } as any)
              }
            }
          } catch (delErr) {
            console.error('PUT /api/licenses remove attachments delete error:', delErr)
          }
        } catch (e) {
          console.error('PUT /api/licenses removeAttachmentsUrls parse error:', e)
        }
      }
      const prevHistory = Array.isArray((before.data() as any)?.history) ? ((before.data() as any).history as any[]) : []
      const actionParts: string[] = []
      if (addedCount > 0) actionParts.push(`added attachments: ${addedCount}`)
      if (removedCount > 0) actionParts.push(`removed attachments: ${removedCount}`)
      const action = actionParts.length ? `Updated license (${actionParts.join(', ')})` : 'Updated license'
      const historyEntry = { id: nanoid(), timestamp: admin.firestore.Timestamp.now(), userId: String(userId || 'system'), action }
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
    const canDelete = ok && (isAdmin(role) || hasPermission(permissions, 'licenses', 'delete') || hasPermission(permissions, 'maintenance', 'delete'))
    if (!canDelete) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    await adb.collection('licenses').doc(params.id).delete()
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('DELETE /api/licenses/[id] error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
