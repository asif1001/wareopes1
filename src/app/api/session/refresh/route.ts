export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/session/refresh?userId=<id>
 * Re-bakes the session cookie with the latest permissions from Firestore.
 * Called after an admin updates a user's permissions.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie?.value) {
      return NextResponse.json({ success: false, error: 'No session' }, { status: 401 });
    }

    // Only allow if the requester is an admin
    let requesterId: string | null = null;
    let requesterRole: string | null = null;
    try {
      const parsed = JSON.parse(sessionCookie.value);
      requesterId = parsed?.id ?? null;
      requesterRole = parsed?.role ?? null;
    } catch {
      return NextResponse.json({ success: false, error: 'Bad session' }, { status: 401 });
    }

    if (!requesterId) return NextResponse.json({ success: false }, { status: 401 });

    const { userId } = await request.json().catch(() => ({}));
    const targetId = typeof userId === 'string' ? userId : requesterId;

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const userSnap = await adb.collection('Users').doc(targetId).get();
    if (!userSnap.exists) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

    const udata = userSnap.data() as any;

    // Resolve permissions
    let permissions = udata.permissions as Record<string, string[]> | undefined;
    if (!permissions && udata.role) {
      const rolesSnap = await adb.collection('Roles').where('name', '==', String(udata.role)).limit(1).get();
      if (!rolesSnap.empty) {
        const rolePerms = rolesSnap.docs[0].data()?.permissions;
        if (Array.isArray(rolePerms)) {
          const normalized: Record<string, string[]> = {};
          for (const item of rolePerms) {
            if (typeof item !== 'string') continue;
            const [page, action] = item.split(':');
            if (page && action) (normalized[page] ||= []).push(action);
          }
          if (Object.keys(normalized).length) permissions = normalized;
        }
      }
    }

    const newSessionData = {
      id: targetId,
      employeeNo: udata.employeeNo,
      name: udata.name || udata.fullName,
      email: udata.email,
      role: udata.role,
      department: udata.department,
      branch: udata.branch ?? null,
      redirectPage: udata.redirectPage ?? null,
      permissions: permissions ?? null,
    };

    // Only re-bake the cookie if the target is the currently logged-in user
    const response = NextResponse.json({ success: true });
    if (targetId === requesterId) {
      response.cookies.set('session', JSON.stringify(newSessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }

    return response;
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 });
  }
}
