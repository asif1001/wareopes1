export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
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

    const adb = await getAdminDb()
    const admin = await getAdmin()
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
      remarks: remarks ? String(remarks) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: [
        { id: nanoid(), timestamp: admin.firestore.Timestamp.now(), userId: String(userId || 'system'), action: 'Created license' },
      ],
    }

    const ref = await adb.collection('licenses').add(payload)
    const snap = await ref.get()
    const data = snap.data() || {}
    const item = {
      id: ref.id,
      ...data,
      createdAt: timestampToISO(data?.createdAt) || null,
      updatedAt: timestampToISO(data?.updatedAt) || null,
    }
    return NextResponse.json({ success: true, item }, { status: 201 })
  } catch (e: any) {
    console.error('POST /api/licenses error:', e)
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}