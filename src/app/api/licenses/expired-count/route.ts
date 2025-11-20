export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions'
import { getAdminDb } from '@/lib/firebase/admin'

export async function GET() {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'licenses', 'view') || hasPermission(permissions, 'maintenance', 'view'))
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const adb = await getAdminDb()
    const snap = await adb.collection('licenses').get()
    const todayStr = new Date().toISOString().slice(0,10)
    let count = 0
    for (const d of snap.docs as any[]) {
      const data = d.data() || {}
      const exp = String(data?.expiryDate || '')
      if (!exp) continue
      // Expired if date is before today
      if (exp < todayStr) count++
    }
    return NextResponse.json({ success: true, count })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}