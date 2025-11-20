export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { getCurrentUserPermissions, hasPermission, isAdmin } from '@/lib/server-permissions'
import { getAdminDb } from '@/lib/firebase/admin'

function daysUntil(dateStr: string): number | null {
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return null
    const diffMs = d.getTime() - Date.now()
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  } catch { return null }
}

export async function GET(request: Request) {
  try {
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const canView = ok && (isAdmin(role) || hasPermission(permissions, 'licenses', 'view') || hasPermission(permissions, 'maintenance', 'view'))
    if (!canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

    const url = new URL(request.url)
    const thresholdParam = url.searchParams.get('days')
    const threshold = Math.max(1, Math.min(Number(thresholdParam || '60'), 365))

    const adb = await getAdminDb()
    const snap = await adb.collection('licenses').get()
    let count = 0
    for (const d of snap.docs as any[]) {
      const data = d.data() || {}
      const expStr = String(data?.expiryDate || '')
      if (!expStr) continue
      const days = daysUntil(expStr)
      if (days == null) continue
      if (days >= 0 && days <= threshold) count++
    }
    return NextResponse.json({ success: true, count, threshold })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 })
  }
}