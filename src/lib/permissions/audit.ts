export const ACCESS_AUDIT_COLLECTION = "permissionAudit";

export type AccessAuditEntry = {
  at: string;
  by: string;
  byName: string;
  action:
    | "ROLE_CREATED"
    | "ROLE_DELETED"
    | "ROLE_PERMISSIONS_CHANGED"
    | "USER_PERMISSIONS_CHANGED"
    | "USER_ROLE_CHANGED"
    | "USER_CREATED"
    | "USER_DELETED"
    | "MIGRATION";
  targetType: "role" | "user" | "system";
  targetId: string;
  targetName: string;
  before: unknown;
  after: unknown;
};

/** Append-only log of access changes (who changed what, when, before and after). */
export async function writeAccessAudit(entry: Omit<AccessAuditEntry, "at">) {
  const { getAdminDb } = await import("@/lib/firebase/admin");
  const db = await getAdminDb();
  await db.collection(ACCESS_AUDIT_COLLECTION).add({ ...entry, at: new Date().toISOString() });
}
