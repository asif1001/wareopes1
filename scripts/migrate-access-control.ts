/**
 * One-time switch to Access control (permissions version 2). Everyone keeps the
 * access they have today; Warehouse 3D and Attendance are never granted.
 *
 *   npx tsx scripts/migrate-access-control.ts            # preview only
 *   npx tsx scripts/migrate-access-control.ts --apply    # write + audit log
 *
 * Safe to run again: records already on version 2 are skipped.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const apply = process.argv.includes("--apply");

(async () => {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { ACCESS_AUDIT_COLLECTION } = await import("../src/lib/permissions/audit");
  const {
    PERMISSIONS_VERSION,
    effectiveRolePermissions,
    effectiveUserOverrides,
    isAdminRole,
    parseRolePermissions,
    parseUserOverrides,
    serializeRolePermissions,
  } = await import("../src/lib/permissions/resolve");

  const db = await getAdminDb();
  const [rolesSnap, usersSnap] = await Promise.all([db.collection("Roles").get(), db.collection("Users").get()]);
  const at = new Date().toISOString();
  const audit: Record<string, unknown>[] = [];
  const writes: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[] = [];

  console.log(apply ? "APPLY mode: changes will be written.\n" : "PREVIEW mode: nothing is written. Add --apply to save.\n");

  console.log("Roles");
  for (const d of rolesSnap.docs) {
    const name = String(d.get("name") ?? d.id);
    if (d.get("permissionsVersion") === PERMISSIONS_VERSION) {
      console.log(`  = ${name}: already migrated`);
      continue;
    }
    const raw: string[] = Array.isArray(d.get("permissions")) ? d.get("permissions").map(String) : [];
    const known = new Set(serializeRolePermissions(parseRolePermissions(raw)));
    const unknown = raw.filter((p) => !known.has(p));
    const migrated = isAdminRole(name) ? [...known] : serializeRolePermissions(effectiveRolePermissions(raw, undefined));
    const next = [...new Set([...migrated, ...unknown])];
    const added = next.filter((p) => !raw.includes(p));
    console.log(`  * ${name}: +${added.length} (${added.join(", ") || "nothing"})${unknown.length ? `; kept unknown: ${unknown.join(", ")}` : ""}`);
    writes.push({ ref: d.ref, data: { permissions: next, permissionsVersion: PERMISSIONS_VERSION } });
    audit.push({ targetType: "role", targetId: d.id, targetName: name, before: raw, after: next });
  }

  console.log("\nUsers");
  let unchanged = 0;
  for (const d of usersSnap.docs) {
    const name = String(d.get("fullName") || d.get("employeeNo") || d.id);
    const version = d.get("permissionsVersion");
    if (version === PERMISSIONS_VERSION) {
      unchanged++;
      continue;
    }
    const value = d.get("permissions");
    const { legacyReplace } = parseUserOverrides(value, version);
    if (!legacyReplace || isAdminRole(d.get("role"))) {
      writes.push({ ref: d.ref, data: { permissionsVersion: PERMISSIONS_VERSION } });
      audit.push({ targetType: "user", targetId: d.id, targetName: name, before: { version: version ?? null }, after: { version: PERMISSIONS_VERSION, overrides: "role" } });
      console.log(`  * ${name} (${d.get("role") || "no role"}): follows role`);
      continue;
    }
    const overrides = effectiveUserOverrides(value, version);
    writes.push({ ref: d.ref, data: { permissions: overrides, permissionsVersion: PERMISSIONS_VERSION } });
    audit.push({ targetType: "user", targetId: d.id, targetName: name, before: { version: version ?? null, permissions: value }, after: { version: PERMISSIONS_VERSION, overrides } });
    const modules = Object.entries(overrides)
      .filter(([, a]) => a && a.length)
      .map(([k, a]) => `${k}[${a!.join("/")}]`);
    console.log(`  * ${name} (${d.get("role") || "no role"}): individual permissions kept as Custom -> ${modules.join(", ") || "no access"}`);
  }
  if (unchanged) console.log(`  = ${unchanged} user(s) already migrated`);

  console.log(`\n${writes.length} record(s) to update.`);
  if (!apply || !writes.length) process.exit(0);

  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) batch.update(w.ref, w.data);
    await batch.commit();
  }
  for (let i = 0; i < audit.length; i += 400) {
    const batch = db.batch();
    for (const a of audit.slice(i, i + 400)) {
      batch.set(db.collection(ACCESS_AUDIT_COLLECTION).doc(), { ...a, at, by: "system", byName: "Access control migration", action: "MIGRATION" });
    }
    await batch.commit();
  }
  console.log("Done. Every change is in Settings → Access control → Audit log.");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
