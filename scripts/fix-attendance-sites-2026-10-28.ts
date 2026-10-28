/**
 * One-off fix approved by the admin on 2026-10-28:
 * - Tubli Warehouse site pin was ~23 km off (in the sea); move it to where staff tapped IN.
 * - Staff linked to the inactive "CPD Salmabad" copy get the active one / have it removed.
 *
 *   npx tsx scripts/fix-attendance-sites-2026-10-28.ts           # preview
 *   npx tsx scripts/fix-attendance-sites-2026-10-28.ts --apply   # write + audit
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const apply = process.argv.includes("--apply");
const TUBLI = "nLZRk98bJuanqpt6cFOQ";
const SALMABAD_ACTIVE = "J4Lg0pWuTN5rR3HoqYhe";
const SALMABAD_INACTIVE = "Eg4VzxNYVRROVJqou941";
const TUBLI_POSITION = { lat: 26.19209, lng: 50.53752 };
const WHO = "admin-approved fix (site pins 2026-10-28)";

(async () => {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { COL } = await import("../src/lib/attendance/store");
  const { writeAudit } = await import("../src/lib/attendance/audit");
  const db = await getAdminDb();
  const now = new Date().toISOString();

  const fenceRef = db.collection(COL.geofences).doc(TUBLI);
  const fence = (await fenceRef.get()).data();
  if (!fence) throw new Error("Tubli Warehouse site not found");
  const fenceAfter = { ...fence, ...TUBLI_POSITION };
  console.log(`Site ${fence.name}: ${fence.lat},${fence.lng} → ${fenceAfter.lat},${fenceAfter.lng} (radius ${fence.radiusM} m)`);

  const staffChanges: { ref: FirebaseFirestore.DocumentReference; name: string; before: string[]; after: string[] }[] = [];
  const staff = await db.collection(COL.staff).where("geofenceIds", "array-contains", SALMABAD_INACTIVE).get();
  for (const d of staff.docs) {
    const before: string[] = d.get("geofenceIds") ?? [];
    let after = before.filter((id) => id !== SALMABAD_INACTIVE);
    if (!after.length) after = [SALMABAD_ACTIVE];
    staffChanges.push({ ref: d.ref, name: String(d.get("name")), before, after });
    console.log(`Staff ${d.get("name")}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
  }

  if (!apply) {
    console.log("\nPreview only. Add --apply to save.");
    process.exit(0);
  }

  await fenceRef.update({ ...TUBLI_POSITION, updatedAt: now });
  await writeAudit(db, { who: WHO, what: "GEOFENCE_UPDATED", entity: "geofence", entityId: TUBLI, before: fence, after: fenceAfter });
  for (const c of staffChanges) {
    await c.ref.update({ geofenceIds: c.after, updatedAt: now });
    await writeAudit(db, { who: WHO, what: "STAFF_UPDATED", entity: "staff", entityId: c.ref.id, before: { geofenceIds: c.before }, after: { geofenceIds: c.after } });
  }
  console.log("\nSaved. Phones pick up the change within 2 hours or when the app is opened.");
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
