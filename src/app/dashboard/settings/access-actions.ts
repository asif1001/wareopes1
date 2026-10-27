"use server";

import { revalidatePath } from "next/cache";
import { ACCESS_AUDIT_COLLECTION, writeAccessAudit, type AccessAuditEntry } from "@/lib/permissions/audit";
import { MODULES, PERMISSION_ACTIONS, type ModuleKey, type PermissionAction } from "@/lib/permissions/registry";
import {
  PERMISSIONS_VERSION,
  effectiveRolePermissions,
  effectiveUserOverrides,
  isAdminRole,
  parseUserOverrides,
  resolveAccess,
  serializeRolePermissions,
  type PermissionMap,
} from "@/lib/permissions/resolve";
import { AccessDenied, requireAdmin } from "@/lib/permissions/server";

type Result = { success: true } | { success: false; error: string };

function sanitize(input: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!input || typeof input !== "object") return out;
  for (const m of MODULES) {
    const actions = (input as Record<string, unknown>)[m.key];
    if (!Array.isArray(actions)) continue;
    out[m.key] = PERMISSION_ACTIONS.filter((a) => m.actions.includes(a) && actions.includes(a));
  }
  return out;
}

function failure(error: unknown): Result {
  if (error instanceof AccessDenied) return { success: false, error: error.message };
  console.error("Access control action failed:", error);
  return { success: false, error: "Could not save. Please try again." };
}

async function db() {
  const { getAdminDb } = await import("@/lib/firebase/admin");
  return getAdminDb();
}

/** Replace a role's permission matrix. The Admin role always has full access and cannot be edited. */
export async function setRolePermissionsAction(roleId: string, permissions: Record<string, PermissionAction[]>): Promise<Result> {
  try {
    const admin = await requireAdmin();
    const adb = await db();
    const ref = adb.collection("Roles").doc(String(roleId));
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Role not found" };
    const name = String(snap.get("name") ?? "");
    if (isAdminRole(name)) return { success: false, error: "The Admin role always has full access" };

    const before = serializeRolePermissions(effectiveRolePermissions(snap.get("permissions"), snap.get("permissionsVersion")));
    const after = serializeRolePermissions(sanitize(permissions));
    await ref.update({ permissions: after, permissionsVersion: PERMISSIONS_VERSION });
    await writeAccessAudit({
      by: admin.userId,
      byName: admin.name,
      action: "ROLE_PERMISSIONS_CHANGED",
      targetType: "role",
      targetId: ref.id,
      targetName: name,
      before,
      after,
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

/**
 * Per-module overrides for one user. A module listed in `overrides` is Custom
 * (an empty list = No Access); any other module follows the user's role.
 */
export async function setUserPermissionsAction(userId: string, overrides: Record<string, PermissionAction[]>): Promise<Result> {
  try {
    const admin = await requireAdmin();
    if (String(userId) === admin.userId) return { success: false, error: "You cannot change your own permissions" };
    const adb = await db();
    const ref = adb.collection("Users").doc(String(userId));
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "User not found" };
    const role = String(snap.get("role") ?? "");
    if (isAdminRole(role)) return { success: false, error: "Admins always have full access. Change their role first." };

    const before = {
      version: snap.get("permissionsVersion") ?? null,
      overrides: effectiveUserOverrides(snap.get("permissions"), snap.get("permissionsVersion")),
    };
    const after = sanitize(overrides);
    await ref.update({ permissions: after, permissionsVersion: PERMISSIONS_VERSION, updatedAt: new Date() });
    await writeAccessAudit({
      by: admin.userId,
      byName: admin.name,
      action: "USER_PERMISSIONS_CHANGED",
      targetType: "user",
      targetId: ref.id,
      targetName: String(snap.get("fullName") || snap.get("employeeNo") || ref.id),
      before,
      after: { version: PERMISSIONS_VERSION, overrides: after },
    });
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    return failure(error);
  }
}

export type AccessUserRow = {
  id: string;
  name: string;
  employeeNo: string;
  role: string;
  department: string;
  isAdmin: boolean;
  /** Modules set to Custom for this user. */
  overrides: PermissionMap;
  /** Old record whose permissions replaced the role entirely (shown as Custom on every module). */
  legacy: boolean;
  effective: PermissionMap;
  sources: Partial<Record<ModuleKey, "admin" | "role" | "custom">>;
};

export type AccessRoleRow = { id: string; name: string; isAdmin: boolean; permissions: PermissionMap; userCount: number };

/** Everything the Access control tab needs (Admin only). */
export async function getAccessControlData(): Promise<{
  roles: AccessRoleRow[];
  users: AccessUserRow[];
  audit: (AccessAuditEntry & { id: string })[];
  currentUserId: string;
}> {
  const admin = await requireAdmin();
  const adb = await db();
  const [rolesSnap, usersSnap, auditSnap] = await Promise.all([
    adb.collection("Roles").get(),
    adb.collection("Users").get(),
    adb.collection(ACCESS_AUDIT_COLLECTION).orderBy("at", "desc").limit(200).get(),
  ]);
  const roleDocs = new Map<string, { permissions: unknown; version: unknown }>();
  for (const d of rolesSnap.docs) roleDocs.set(String(d.get("name") ?? ""), { permissions: d.get("permissions"), version: d.get("permissionsVersion") });

  const users: AccessUserRow[] = usersSnap.docs.map((d) => {
    const role = String(d.get("role") ?? "");
    const version = d.get("permissionsVersion");
    const { legacyReplace } = parseUserOverrides(d.get("permissions"), version);
    const overrides = effectiveUserOverrides(d.get("permissions"), version);
    const roleDoc = roleDocs.get(role);
    const access = resolveAccess({
      role,
      rolePermissions: roleDoc?.permissions,
      roleVersion: roleDoc?.version,
      userPermissions: d.get("permissions"),
      permissionsVersion: version,
    });
    return {
      id: d.id,
      name: String(d.get("fullName") || d.get("name") || d.get("employeeNo") || d.id),
      employeeNo: String(d.get("employeeNo") ?? ""),
      role,
      department: String(d.get("department") ?? ""),
      isAdmin: access.isAdmin,
      overrides,
      legacy: legacyReplace,
      effective: access.permissions,
      sources: access.sources,
    };
  });
  users.sort((a, b) => a.name.localeCompare(b.name));

  const roles: AccessRoleRow[] = rolesSnap.docs
    .map((d) => {
      const name = String(d.get("name") ?? "");
      return {
        id: d.id,
        name,
        isAdmin: isAdminRole(name),
        permissions: effectiveRolePermissions(d.get("permissions"), d.get("permissionsVersion")),
        userCount: users.filter((u) => u.role === name).length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const audit = auditSnap.docs.map((d) => ({ id: d.id, ...(d.data() as AccessAuditEntry) }));
  return { roles, users, audit: JSON.parse(JSON.stringify(audit)), currentUserId: admin.userId };
}
