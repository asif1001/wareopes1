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

export async function GET(request: NextRequest) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'view'))
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const driverParam = url.searchParams.get('driverId')
    const limit = Math.max(1, Math.min(Number(limitParam || '50'), 200))

    let q: any = adb.collection('licenses').orderBy('createdAt', 'desc').limit(limit)
    if (driverParam) q = q.where('driverId', '==', driverParam)
    const snap = await q.get()
    const items = snap.docs.map((d: any) => {
      const data = d.data()
      return {
        id: d.id,
        ...data,
        createdAt: timestampToISO(data?.createdAt) || data?.createdAt || null,
        updatedAt: timestampToISO(data?.updatedAt) || data?.updatedAt || null,
      }
    })
    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    console.error('GET /api/licenses error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ok, role, permissions, userId } = await getCurrentUserPermissions()
    const canAdd = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'add'))
    if (!canAdd) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const ct = request.headers.get('content-type') || ''
    const adb = await getAdminDb()
    const admin = await getAdmin()
    if (ct.includes('multipart/form-data')) {
      const formData = await request.formData()
      const raw = Object.fromEntries(formData.entries())
      const required = ['driverId', 'vehicleType', 'licenseNumber', 'issueDate', 'expiryDate']
      const missing = required.filter((k) => !raw?.[k])
      if (missing.length) return NextResponse.json({ success: false, error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })

      const base = {
        driverId: String(raw.driverId),
        vehicleType: String(raw.vehicleType),
        licenseNumber: String(raw.licenseNumber),
        issueDate: String(raw.issueDate),
        expiryDate: String(raw.expiryDate),
        remarks: raw.remarks ? String(raw.remarks) : null,
        attachments: [],
        attachmentUrl: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        history: [{ id: nanoid(), timestamp: admin.firestore.Timestamp.now(), userId: String(userId || 'system'), action: 'Created license' }],
      } as any

      const ref = await adb.collection('licenses').add(base)
      const filesRaw = formData.getAll('attachments')
      const files = (filesRaw as any[]).filter(x => x && typeof x.arrayBuffer === 'function') as any[]
      if (files.length) {
        try {
          const storage = getStorage()
          const bucket = storage.bucket()
          const urls: string[] = []
          for (const file of files) {
            const name = String((file as any).name || 'file')
            const safe = name.replace(/[^a-zA-Z0-9._-]/g, '_')
            const storagePath = `licenses/${ref.id}/attachments/${Date.now()}-${nanoid()}-${safe}`
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
          await ref.update({ attachments: urls, attachmentUrl: urls[0] || null, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
        } catch (e) {
          console.error('POST /api/licenses upload error:', e)
        }
      }
      const snap = await ref.get()
      const data = snap.data() || {}
      const item = { id: ref.id, ...data, createdAt: timestampToISO(data?.createdAt) || null, updatedAt: timestampToISO(data?.updatedAt) || null }
      return NextResponse.json({ success: true, item }, { status: 201 })
    } else {
      const body = await request.json()
      const { driverId, vehicleType, licenseNumber, issueDate, expiryDate, attachmentUrl, remarks } = body || {}
      const required = ['driverId', 'vehicleType', 'licenseNumber', 'issueDate', 'expiryDate']
      const missing = required.filter((k) => !body?.[k])
      if (missing.length) return NextResponse.json({ success: false, error: `Missing required fields: ${missing.join(', ')}` }, { status: 400 })
      const payload = {
        driverId: String(driverId),
        vehicleType: String(vehicleType),
        licenseNumber: String(licenseNumber),
        issueDate: String(issueDate),
        expiryDate: String(expiryDate),
        attachmentUrl: attachmentUrl ? String(attachmentUrl) : null,
        attachments: attachmentUrl ? [String(attachmentUrl)] : [],
        remarks: remarks ? String(remarks) : null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        history: [ { id: nanoid(), timestamp: admin.firestore.Timestamp.now(), userId: String(userId || 'system'), action: 'Created license' } ],
      }
      const ref = await adb.collection('licenses').add(payload)
      const snap = await ref.get()
      const data = snap.data() || {}
      const item = { id: ref.id, ...data, createdAt: timestampToISO(data?.createdAt) || null, updatedAt: timestampToISO(data?.updatedAt) || null }
      return NextResponse.json({ success: true, item }, { status: 201 })
    }
  } catch (e: any) {
    console.error('POST /api/licenses error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}
