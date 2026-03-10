import type { UserPermissions } from '@/lib/types';
import { cookies } from 'next/headers';

export async function getCurrentUserPermissions(): Promise<{ ok: boolean; userId?: string; role?: string; permissions?: UserPermissions; branch?: string }>{
  try {
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
    if (!userId) return { ok: false };

    const { getAdminDb } = await import('@/lib/firebase/admin');
    const adb = await getAdminDb();
    const userSnap = await adb.collection('Users').doc(userId).get();
    if (!userSnap.exists) return { ok: false };
    const udata = userSnap.data() as any;
    let permissions: UserPermissions | undefined = udata?.permissions as any;
    const role: string | undefined = udata?.role;
    const branch: string | undefined = typeof udata?.branch === 'string' ? udata.branch : undefined;

    // Normalize permissions from role if explicit not set
    if (!permissions && role) {
      const rolesSnap = await adb.collection('Roles').where('name', '==', String(role)).get();
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
        permissions = normalized as any;
      }
    }

    return { ok: true, userId, role, permissions, branch };
  } catch {
    return { ok: false };
  }
}

export function hasPermission(permissions: UserPermissions | undefined, page: keyof NonNullable<UserPermissions>, action: string): boolean {
  if (!permissions) return false;
  const acts = (permissions as any)[page];
  return Array.isArray(acts) && acts.includes(action);
}

export function isAdmin(role?: string): boolean {
  return role === 'Admin';
}