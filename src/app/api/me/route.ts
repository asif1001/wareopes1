export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

// Returns the current user from the secure session cookie with normalized permissions.
// Normalization rule: if a user has no explicit permissions, fall back to role-based permissions
// in `Roles` collection (stored as ["page:action", ...]) and convert to structured object.
export async function GET() {
  try {
    const { cookies } = await import('next/headers');
    const sessionCookie = (await cookies()).get('session');

    let userId: string | null = null;
    if (sessionCookie?.value) {
      try {
        const parsed = JSON.parse(sessionCookie.value);
        userId = typeof parsed?.id === 'string' ? parsed.id : sessionCookie.value;
      } catch {
        userId = sessionCookie.value;
      }
    }

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized: no session' }, { status: 401 });
    }

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();

    const userSnap = await adb.collection('Users').doc(userId).get();
    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const udata = userSnap.data() as any;

    // Normalize permissions: prefer explicit, else derive from role
    let permissions = udata?.permissions as any | undefined;
    if (!permissions && udata?.role) {
      const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).get();
      if (!rolesSnap.empty) {
        const roleData = rolesSnap.docs[0].data() as any;
        const arr = Array.isArray(roleData?.permissions) ? roleData.permissions : [];
        const normalized: Record<string, string[]> = {};
        for (const item of arr) {
          if (typeof item !== 'string') continue;
          const [page, action] = item.split(':');
          if (!page || !action) continue;
          (normalized[page] ||= []).push(action);
        }
        permissions = Object.keys(normalized).length ? normalized : undefined;
      }
    }

    const payload = {
      success: true,
      id: userSnap.id,
      employeeNo: String(udata.employeeNo || ''),
      fullName: String(udata.fullName || udata.name || ''),
      name: udata.name,
      role: udata.role,
      department: udata.department,
      email: udata.email,
      branch: typeof udata.branch === 'string' ? udata.branch : undefined,
      redirectPage: udata.redirectPage,
      permissions,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    console.error('GET /api/me error:', e);
    return NextResponse.json({ success: false, error: e?.message || 'Server error' }, { status: 500 });
  }
}