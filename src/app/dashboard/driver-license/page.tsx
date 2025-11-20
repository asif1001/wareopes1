import { Suspense } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { DriverLicenseClientPage } from "@/components/driver-license-client-page"
import { getUsers } from "@/lib/firebase/firestore"
import { cookies } from "next/headers"

async function getCurrentUserPermissions(): Promise<{ ok: boolean; role?: string; permissions?: any }>{
  try {
    const sessionCookie = (await cookies()).get('session')
    let userId: string | null = null
    if (sessionCookie?.value) {
      try {
        const parsed = JSON.parse(sessionCookie.value)
        userId = typeof parsed?.id === 'string' ? parsed.id : sessionCookie.value
      } catch {
        userId = sessionCookie.value
      }
    }
    if (!userId) return { ok: false }
    const { getAdminDb } = await import('@/lib/firebase/admin')
    const adb = await getAdminDb()
    const userSnap = await adb.collection('Users').doc(userId).get()
    if (!userSnap.exists) return { ok: false }
    const udata = userSnap.data() as any
    let permissions: any | undefined = udata?.permissions as any
    const role: string | undefined = udata?.role
    if (!permissions && role) {
      const rolesSnap = await adb.collection('Roles').where('name', '==', String(role)).get()
      if (!rolesSnap.empty) {
        const roleData = rolesSnap.docs[0].data() as any
        const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : []
        const normalized: Record<string, string[]> = {}
        for (const item of arr) {
          if (typeof item !== 'string') continue
          const [page, action] = item.split(':')
          if (!page || !action) continue
          ;(normalized[page] ||= []).push(action)
        }
        permissions = normalized as any
      }
    }
    return { ok: true, role, permissions }
  } catch {
    return { ok: false }
  }
}

export default function DriverLicensePage() {
  const Page = async () => {
    const { ok, role, permissions } = await getCurrentUserPermissions()
    const p: any = permissions || {}
    const canView = ok && (role === 'Admin' || (Array.isArray(p?.licenses) && p.licenses.includes('view')) || (Array.isArray(p?.maintenance) && p.maintenance.includes('view')))
    if (!canView) {
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <div className="w-full max-w-md border rounded-lg p-6">
            <div className="text-center text-lg font-semibold">Access Denied</div>
            <div className="text-center text-sm text-muted-foreground mt-2">You don't have permission to access Driver License.</div>
          </div>
        </div>
      )
    }
    const usersRaw = await getUsers().catch(() => [])
    const { getAdminDb } = await import('@/lib/firebase/admin')
    const adb = await getAdminDb()
    const licensesSnap = await adb.collection('licenses').orderBy('createdAt', 'desc').limit(100).get().catch(() => ({ docs: [] } as any))
    const toIso = (v: any): string | undefined => {
      if (!v) return undefined
      if (typeof v === 'string') return v
      if (v instanceof Date) return v.toISOString()
      if (typeof v?.toDate === 'function') { try { return v.toDate().toISOString() } catch {} }
      if (typeof v?._seconds === 'number') { const ms = (v._seconds * 1000) + Math.floor((v._nanoseconds || 0) / 1_000_000); return new Date(ms).toISOString() }
      return undefined
    }
    const users = (usersRaw as any[]).map(u => ({ id: String(u.id || ''), fullName: typeof u.fullName === 'string' ? u.fullName : (typeof u.name === 'string' ? u.name : ''), name: typeof u.name === 'string' ? u.name : undefined }))
    const licenses = (licensesSnap as any).docs.map((d: any) => { const l = d.data() || {}; return { id: d.id, driverId: l.driverId, vehicleType: l.vehicleType || '', licenseNumber: l.licenseNumber || '', issueDate: toIso(l.issueDate), expiryDate: toIso(l.expiryDate), attachments: Array.isArray(l.attachments) ? l.attachments : (l.attachmentUrl ? [String(l.attachmentUrl)] : []), attachmentUrl: l.attachmentUrl ?? null, remarks: l.remarks ?? null } })
    return (
      <div className="flex flex-col h-full">
        <DashboardHeader title="Driver License" />
        <main className="flex-1 flex flex-col gap-4 p-4 lg:gap-6 lg:p-6 overflow-auto">
          <Suspense fallback={<div>Loading...</div>}>
            <DriverLicenseClientPage initialUsers={users as any} initialLicenses={licenses as any} />
          </Suspense>
        </main>
      </div>
    )
  }
  return <Page />
}
