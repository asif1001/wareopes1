import * as React from "react";
import { getSession, type SessionPayload } from "@/lib/session";
import { ADMIN_ONLY_PATHS, type ModuleKey, type PermissionAction } from "./registry";
import { can, resolveAccess, type EffectiveAccess } from "./resolve";

export type AccessContext = EffectiveAccess & {
  userId: string;
  name: string;
  branch?: string;
  session: SessionPayload;
};

export class AccessDenied extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

// React's per-request cache exists only in the server build (not in tests or scripts).
const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  typeof (React as { cache?: unknown }).cache === "function" ? (React as unknown as { cache: <T>(fn: T) => T }).cache : (fn) => fn;

/** The signed-in user's effective access (one Firestore read per request), or null when not signed in. */
export const getAccess = cache(async (): Promise<AccessContext | null> => {
  const session = await getSession();
  if (!session) return null;
  const { getAdminDb } = await import("@/lib/firebase/admin");
  const db = await getAdminDb();
  const snap = await db.collection("Users").doc(session.id).get();
  if (!snap.exists) return null;
  const user = snap.data() as Record<string, unknown>;
  const role = typeof user.role === "string" ? user.role : "";
  let rolePermissions: unknown = [];
  let roleVersion: unknown;
  if (role) {
    const roles = await db.collection("Roles").where("name", "==", role).limit(1).get();
    if (!roles.empty) {
      rolePermissions = roles.docs[0].get("permissions");
      roleVersion = roles.docs[0].get("permissionsVersion");
    }
  }
  const access = resolveAccess({
    role,
    rolePermissions,
    roleVersion,
    userPermissions: user.permissions,
    permissionsVersion: user.permissionsVersion,
  });
  return {
    ...access,
    userId: snap.id,
    name: String(user.fullName || user.name || user.employeeNo || snap.id),
    branch: typeof user.branch === "string" ? user.branch : undefined,
    session,
  };
});

/** Throws AccessDenied unless the user is signed in (and, if given, has the permission). */
export async function requireAccess(module?: ModuleKey, action: PermissionAction = "view"): Promise<AccessContext> {
  const access = await getAccess();
  if (!access) throw new AccessDenied(401, "Please log in");
  if (module && !can(access, module, action)) throw new AccessDenied(403, "You do not have permission for this action");
  return access;
}

export async function requireAdmin(): Promise<AccessContext> {
  const access = await requireAccess();
  if (!access.isAdmin) throw new AccessDenied(403, "Only an admin can do this");
  return access;
}

/** Route handlers: `{ ok: false, response }` with 401/403 when access is missing. */
export async function apiAccess(module?: ModuleKey, action: PermissionAction = "view") {
  try {
    return { ok: true as const, access: await requireAccess(module, action) };
  } catch (error) {
    const { NextResponse } = await import("next/server");
    const status = error instanceof AccessDenied ? error.status : 500;
    const message = error instanceof AccessDenied ? error.message : "Server error";
    return { ok: false as const, response: NextResponse.json({ success: false, error: message }, { status }) };
  }
}

/** Server actions: returns an error message, or null when allowed. */
export async function actionDenied(module?: ModuleKey, action: PermissionAction = "view"): Promise<string | null> {
  try {
    await requireAccess(module, action);
    return null;
  } catch (error) {
    return error instanceof AccessDenied ? error.message : "Permission check failed";
  }
}

/** Server pages: redirect to login or the dashboard when the user may not open the page. */
export async function guardPage(module: ModuleKey | "admin" | "signed-in", action: PermissionAction = "view"): Promise<AccessContext> {
  const { redirect } = await import("next/navigation");
  const access = await getAccess();
  if (!access) redirect("/");
  if (module === "signed-in") return access!;
  if (module === "admin") {
    if (!access!.isAdmin) redirect("/dashboard?denied=admin");
    return access!;
  }
  if (!can(access, module, action)) redirect(module === "dashboard" ? "/my-account?denied=dashboard" : `/dashboard?denied=${module}`);
  return access!;
}

export function isAdminOnlyPath(pathname: string) {
  return ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
