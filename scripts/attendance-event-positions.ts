/**
 * Read-only: GPS positions of recent events and their distance to each active site.
 *   npx tsx scripts/attendance-event-positions.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const R = 6371000;
const dist = (a: [number, number], b: [number, number]) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

(async () => {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { COL } = await import("../src/lib/attendance/store");
  const db = await getAdminDb();
  const [staff, fences, events] = await Promise.all([
    db.collection(COL.staff).get(),
    db.collection(COL.geofences).where("active", "==", true).get(),
    db.collection(COL.events).where("receivedAt", ">=", "2026-10-27T00:00:00Z").get(),
  ]);
  const names = new Map(staff.docs.map((d) => [d.id, String(d.get("name"))]));
  for (const e of events.docs.map((d) => d.data()).sort((a, b) => String(a.deviceTime).localeCompare(String(b.deviceTime)))) {
    if (e.lat == null) continue;
    const p: [number, number] = [e.lat, e.lng];
    const near = fences.docs.map((f) => `${f.get("name")}: ${dist(p, [f.get("lat"), f.get("lng")])} m`).join(" · ");
    console.log(`${names.get(e.staffId)} ${e.type} ${e.deviceTime} at ${e.lat.toFixed(5)},${e.lng.toFixed(5)} (±${e.accuracyM} m) → ${near}`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
