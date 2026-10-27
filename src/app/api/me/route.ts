export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { getAccess } from '@/lib/permissions/server';

// Returns the signed-in user with their effective permissions (role + per-module overrides).
export async function GET() {
  try {
    const access = await getAccess();
    if (!access) {
      return NextResponse.json({ success: false, error: 'Unauthorized: no session' }, { status: 401 });
    }
    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const udata = ((await adb.collection('Users').doc(access.userId).get()).data() ?? {}) as Record<string, any>;

    return NextResponse.json({
      success: true,
      id: access.userId,
      employeeNo: String(udata.employeeNo || ''),
      fullName: String(udata.fullName || udata.name || ''),
      name: udata.name,
      role: udata.role,
      department: udata.department,
      email: udata.email,
      branch: typeof udata.branch === 'string' ? udata.branch : undefined,
      redirectPage: udata.redirectPage,
      isAdmin: access.isAdmin,
      permissions: access.permissions,
      permissionSources: access.sources,
    });
  } catch (e: any) {
    console.error('GET /api/me error:', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
