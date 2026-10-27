import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MODULES, moduleForPath } from "@/lib/permissions/registry";
import {
  PERMISSIONS_VERSION,
  can,
  effectiveRolePermissions,
  effectiveUserOverrides,
  migratePermissionMap,
  parseRolePermissions,
  resolveAccess,
  serializeRolePermissions,
} from "@/lib/permissions/resolve";
import { signSession, verifySession } from "@/lib/session";

const V2 = PERMISSIONS_VERSION;

describe("registry", () => {
  it("lists Attendance and Warehouse 3D as new modules", () => {
    const fresh = MODULES.filter((m) => m.isNew).map((m) => m.key);
    expect(fresh).toEqual(expect.arrayContaining(["attendance", "warehouse"]));
    expect(MODULES.find((m) => m.key === "attendance")?.actions).toContain("approve");
  });

  it("maps paths to the owning module", () => {
    expect(moduleForPath("/dashboard")?.key).toBe("dashboard");
    expect(moduleForPath("/dashboard/warehouse")?.key).toBe("warehouse");
    expect(moduleForPath("/dashboard/attendance/anything")?.key).toBe("attendance");
    expect(moduleForPath("/dashboard/dispatch")?.key).toBe("dispatches");
    expect(moduleForPath("/dashboard/unknown-future-page")).toBeNull();
  });
});

describe("resolveAccess (version 2)", () => {
  const role = ["shipments:view", "shipments:edit", "tasks:view"];

  it("admin gets every action on every module, including new ones", () => {
    const a = resolveAccess({ role: "admin" });
    expect(a.isAdmin).toBe(true);
    for (const m of MODULES) for (const act of m.actions) expect(can(a, m.key, act)).toBe(true);
  });

  it("uses the role when the user has no overrides", () => {
    const a = resolveAccess({ role: "Supervisor", rolePermissions: role, roleVersion: V2, permissionsVersion: V2 });
    expect(can(a, "shipments", "edit")).toBe(true);
    expect(can(a, "shipments", "delete")).toBe(false);
    expect(a.sources.shipments).toBe("role");
  });

  it("denies everything that is not granted (new and unknown modules)", () => {
    const a = resolveAccess({ role: "Supervisor", rolePermissions: role, roleVersion: V2, permissionsVersion: V2 });
    expect(can(a, "warehouse", "view")).toBe(false);
    expect(can(a, "attendance", "view")).toBe(false);
    expect(can(a, "settings", "view")).toBe(false);
    expect(can(null, "shipments", "view")).toBe(false);
  });

  it("a Custom module overrides only that module", () => {
    const a = resolveAccess({
      role: "Supervisor",
      rolePermissions: role,
      roleVersion: V2,
      userPermissions: { shipments: ["view"], warehouse: ["view", "export"] },
      permissionsVersion: V2,
    });
    expect(can(a, "shipments", "edit")).toBe(false);
    expect(can(a, "warehouse", "export")).toBe(true);
    expect(can(a, "tasks", "view")).toBe(true);
    expect(a.sources).toMatchObject({ shipments: "custom", warehouse: "custom", tasks: "role" });
  });

  it("an empty Custom list means No Access", () => {
    const a = resolveAccess({ role: "Supervisor", rolePermissions: role, roleVersion: V2, userPermissions: { tasks: [] }, permissionsVersion: V2 });
    expect(can(a, "tasks", "view")).toBe(false);
    expect(a.sources.tasks).toBe("custom");
  });

  it("ignores unknown modules and actions a module does not support", () => {
    const a = resolveAccess({
      role: "X",
      rolePermissions: ["made_up:view", "tasks:approve", "tasks:view"],
      roleVersion: V2,
      userPermissions: { evil: ["view"], feedback: ["delete"] },
      permissionsVersion: V2,
    });
    expect(a.permissions).toEqual({ tasks: ["view"] });
    expect(a.sources.feedback).toBe("custom");
  });
});

describe("migration keeps current access", () => {
  it("legacy roles get the formerly open pages and export, never the new modules", () => {
    const perms = effectiveRolePermissions(["shipments:view", "attendance:edit", "attendance:view"], undefined);
    expect(perms.dashboard).toEqual(["view", "export"]);
    expect(perms.dispatches).toEqual(["view", "add", "edit", "delete", "export"]);
    expect(perms.shipments).toEqual(["view", "export"]);
    expect(perms.attendance).toEqual(["view", "edit", "approve", "export"]);
    expect(perms.warehouse).toBeUndefined();
  });

  it("version 2 roles are used exactly as saved", () => {
    expect(effectiveRolePermissions(["shipments:view"], V2)).toEqual({ shipments: ["view"] });
  });

  it("legacy user permissions still replace the role (every module Custom)", () => {
    const overrides = effectiveUserOverrides({ tasks: ["view"] }, undefined);
    expect(Object.keys(overrides).sort()).toEqual(MODULES.map((m) => m.key).sort());
    expect(overrides.tasks).toEqual(["view"]);
    expect(overrides.shipments).toEqual([]);
    expect(overrides.warehouse).toEqual([]);
    expect(overrides.dashboard).toEqual(["view", "export"]);

    const a = resolveAccess({ role: "Supervisor", rolePermissions: ["shipments:view"], userPermissions: { tasks: ["view"] } });
    expect(can(a, "shipments", "view")).toBe(false);
    expect(can(a, "tasks", "view")).toBe(true);
  });

  it("an old empty permissions object also replaced the role", () => {
    const a = resolveAccess({ role: "Supervisor", rolePermissions: ["shipments:view"], userPermissions: {} });
    expect(can(a, "shipments", "view")).toBe(false);
    expect(can(a, "dashboard", "view")).toBe(true);
  });

  it("users without permissions follow the (migrated) role", () => {
    const a = resolveAccess({ role: "Supervisor", rolePermissions: ["shipments:view"] });
    expect(can(a, "shipments", "view")).toBe(true);
    expect(can(a, "shipments", "export")).toBe(true);
    expect(can(a, "warehouse", "view")).toBe(false);
  });

  it("is idempotent", () => {
    const once = migratePermissionMap({ shipments: ["view"] }, { fillAllModules: false });
    expect(migratePermissionMap(once, { fillAllModules: false })).toEqual(once);
  });

  it("role strings round-trip", () => {
    const list = ["tasks:view", "attendance:approve", "shipments:export"];
    expect(serializeRolePermissions(parseRolePermissions(list)).sort()).toEqual([...list].sort());
  });
});

describe("signed session cookie", () => {
  const previous = process.env.SESSION_SECRET;
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  });
  afterEach(() => {
    process.env.SESSION_SECRET = previous;
  });

  it("verifies its own signature", async () => {
    const token = await signSession({ id: "u1", role: "Supervisor" });
    const s = await verifySession(token);
    expect(s?.id).toBe("u1");
  });

  it("rejects tampering, the old JSON cookie, and a plain user id", async () => {
    const token = await signSession({ id: "u1", role: "Supervisor" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), id: "admin1" })).toString("base64url");
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
    expect(await verifySession(JSON.stringify({ id: "admin1" }))).toBeNull();
    expect(await verifySession("admin1")).toBeNull();
  });

  it("expires after 7 days", async () => {
    const now = Date.UTC(2026, 9, 1);
    const token = await signSession({ id: "u1" }, now);
    expect(await verifySession(token, now + 6 * 86400_000)).not.toBeNull();
    expect(await verifySession(token, now + 8 * 86400_000)).toBeNull();
  });

  it("rejects everything when the secret is missing or short", async () => {
    const token = await signSession({ id: "u1" });
    process.env.SESSION_SECRET = "short";
    expect(await verifySession(token)).toBeNull();
  });
});
