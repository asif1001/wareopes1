import { MODULES, PERMISSION_ACTIONS, getModule, type ModuleKey, type PermissionAction } from "./registry";

export type PermissionMap = Partial<Record<ModuleKey, PermissionAction[]>>;
export type AccessSource = "admin" | "role" | "custom";

export type EffectiveAccess = {
  isAdmin: boolean;
  role: string;
  permissions: PermissionMap;
  /** Where each module's access comes from. */
  sources: Partial<Record<ModuleKey, AccessSource>>;
};

/** Version 2 = per-module overrides on top of the role. Older user records replaced the role entirely. */
export const PERMISSIONS_VERSION = 2;

export function isAdminRole(role: unknown) {
  return typeof role === "string" && role.trim().toLowerCase() === "admin";
}

function clean(key: string, actions: unknown): PermissionAction[] | null {
  const module = getModule(key);
  if (!module || !Array.isArray(actions)) return null;
  const allowed = new Set<string>(module.actions);
  return PERMISSION_ACTIONS.filter((a) => allowed.has(a) && actions.includes(a));
}

/** Role documents store `["module:action", …]`; unknown entries are ignored. */
export function parseRolePermissions(list: unknown): PermissionMap {
  const out: PermissionMap = {};
  if (!Array.isArray(list)) return out;
  const raw: Record<string, string[]> = {};
  for (const item of list) {
    if (typeof item !== "string") continue;
    const [module, action] = item.split(":");
    if (module && action) (raw[module] ||= []).push(action);
  }
  for (const [key, actions] of Object.entries(raw)) {
    const c = clean(key, actions);
    if (c?.length) out[key as ModuleKey] = c;
  }
  return out;
}

export function serializeRolePermissions(map: PermissionMap): string[] {
  const out: string[] = [];
  for (const m of MODULES) {
    for (const a of clean(m.key, map[m.key] ?? []) ?? []) out.push(`${m.key}:${a}`);
  }
  return out;
}

/**
 * User overrides: a module key that is present means "Custom" (an empty list means No Access).
 * Before version 2 any permissions object (even `{}`) replaced the role completely.
 */
export function parseUserOverrides(value: unknown, version: unknown): { overrides: PermissionMap; legacyReplace: boolean } {
  const overrides: PermissionMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return { overrides, legacyReplace: false };
  for (const [key, actions] of Object.entries(value as Record<string, unknown>)) {
    const c = clean(key, actions);
    if (c) overrides[key as ModuleKey] = c;
  }
  return { overrides, legacyReplace: version !== PERMISSIONS_VERSION };
}

/** Role permissions as they apply now; roles saved before version 2 get the migration grants. */
export function effectiveRolePermissions(list: unknown, version: unknown): PermissionMap {
  const parsed = parseRolePermissions(list);
  return version === PERMISSIONS_VERSION ? parsed : migratePermissionMap(parsed, { fillAllModules: false });
}

/** User overrides as they apply now; old "replace the role" records become Custom on every module. */
export function effectiveUserOverrides(value: unknown, version: unknown): PermissionMap {
  const { overrides, legacyReplace } = parseUserOverrides(value, version);
  return legacyReplace ? migratePermissionMap(overrides, { fillAllModules: true }) : overrides;
}

export function resolveAccess(input: {
  role?: string;
  rolePermissions?: unknown;
  /** `permissionsVersion` of the role document. */
  roleVersion?: unknown;
  userPermissions?: unknown;
  permissionsVersion?: unknown;
}): EffectiveAccess {
  const role = typeof input.role === "string" ? input.role : "";
  if (isAdminRole(role)) {
    const permissions: PermissionMap = {};
    const sources: EffectiveAccess["sources"] = {};
    for (const m of MODULES) {
      permissions[m.key] = [...m.actions];
      sources[m.key] = "admin";
    }
    return { isAdmin: true, role, permissions, sources };
  }

  const fromRole = effectiveRolePermissions(input.rolePermissions, input.roleVersion);
  const overrides = effectiveUserOverrides(input.userPermissions, input.permissionsVersion);
  const permissions: PermissionMap = {};
  const sources: EffectiveAccess["sources"] = {};
  for (const m of MODULES) {
    const custom = overrides[m.key];
    if (custom !== undefined) {
      sources[m.key] = "custom";
      if (custom?.length) permissions[m.key] = custom;
    } else if (fromRole[m.key]?.length) {
      sources[m.key] = "role";
      permissions[m.key] = fromRole[m.key];
    }
  }
  return { isAdmin: false, role, permissions, sources };
}

export function can(access: Pick<EffectiveAccess, "isAdmin" | "permissions"> | null | undefined, module: ModuleKey, action: PermissionAction) {
  if (!access) return false;
  if (access.isAdmin) return true;
  return !!access.permissions[module]?.includes(action);
}

// ---------------------------------------------------------------------------
// Migration to the access-control model (keeps everyone's current access)
// ---------------------------------------------------------------------------

/**
 * What existing roles and users keep when access control is switched on:
 * - modules that were open to everyone stay open (view + their actions);
 * - whoever could view a module keeps exporting it (export was never restricted);
 * - whoever could edit attendance keeps approving overtime;
 * - new features (Warehouse 3D, Attendance) are never granted automatically.
 */
export const LEGACY_OPEN_GRANTS: PermissionMap = {
  dashboard: ["view", "export"],
  dispatches: ["view", "add", "edit", "delete", "export"],
  reports: ["view", "export"],
  feedback: ["view", "add"],
};

export function migratePermissionMap(current: PermissionMap, options: { fillAllModules: boolean }): PermissionMap {
  const out: PermissionMap = {};
  for (const m of MODULES) {
    const existing = current[m.key];
    const actions = new Set<PermissionAction>(existing ?? []);
    if (m.key !== "warehouse") {
      if (!m.isNew) for (const a of LEGACY_OPEN_GRANTS[m.key] ?? []) actions.add(a);
      if (actions.has("view") && m.actions.includes("export")) actions.add("export");
      if (m.key === "attendance" && actions.has("edit")) actions.add("approve");
    }
    const list = PERMISSION_ACTIONS.filter((a) => actions.has(a) && m.actions.includes(a));
    if (list.length || options.fillAllModules) out[m.key] = list;
  }
  return out;
}
