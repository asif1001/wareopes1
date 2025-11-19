export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
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
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const canEdit = ok && (isAdmin(role) || hasPermission(permissions, 'maintenance', 'edit'))
    if (!canEdit) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    const admin = await getAdmin()
    const body = await request.json()
    const ref = adb.collection('licenses').doc(params.id)
    await ref.update({ ...body, updatedAt: admin.firestore.FieldValue.serverTimestamp() })
    const snap = await ref.get()
    const data = snap.data() || {}
    const item = { id: params.id, ...data, createdAt: timestampToISO(data?.createdAt) || null, updatedAt: timestampToISO(data?.updatedAt) || null }
    return NextResponse.json({ success: true, item })
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