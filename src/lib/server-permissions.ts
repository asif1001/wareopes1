import type { UserPermissions } from '@/lib/types';
import { getAccess } from '@/lib/permissions/server';
import { isAdminRole } from '@/lib/permissions/resolve';

/**
 * The signed-in user's effective permissions (role + per-module overrides; Admin has everything).
 * Kept for existing callers; new code can use `requireAccess` from `@/lib/permissions/server`.
 */
export async function getCurrentUserPermissions(): Promise<{ ok: boolean; userId?: string; role?: string; permissions?: UserPermissions; branch?: string }>{
  try {
    const access = await getAccess();
    if (!access) return { ok: false };
    return { ok: true, userId: access.userId, role: access.role, permissions: access.permissions, branch: access.branch };
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
  return isAdminRole(role);
}
