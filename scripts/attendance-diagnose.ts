/**
 * Read-only check of why phones are (not) recording attendance.
 *   npx tsx scripts/attendance-diagnose.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

(async () => {
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const { COL } = await import("../src/lib/attendance/store");
  const db = await getAdminDb();

  const [staffSnap, healthSnap, shiftsSnap, fencesSnap, crashSnap, settingsSnap] = await Promise.all([
    db.collection(COL.staff).get(),
    db.collection(COL.deviceHealth).get(),
    db.collection(COL.shifts).get(),
    db.collection(COL.geofences).get(),
    db.collection(COL.crashReports).orderBy("receivedAt", "desc").limit(10).get(),
    db.collection(COL.settings).get(),
  ]);

  console.log("== Settings");
  for (const d of settingsSnap.docs) {
    const s = d.data();
    console.log(d.id, JSON.stringify({ timezone: s.timezone, weeklyOff: s.weeklyOffDays, minAppVersion: s.minAppVersion, latestAppVersion: s.latestAppVersion }));
  }
  console.log("\n== Shifts");
  for (const d of shiftsSnap.docs) {
    const s = d.data();
    console.log(d.id, s.name, s.startTime, "-", s.endTime, "grace", s.graceBeforeMin, s.graceAfterMin, s.active ? "" : "(inactive)");
  }
  console.log("\n== Geofences");
  for (const d of fencesSnap.docs) {
    const g = d.data();
    console.log(d.id, g.name, `${g.lat},${g.lng}`, `r=${g.radiusM}m`, g.active ? "" : "(inactive)");
  }

  const health = new Map(healthSnap.docs.map((d) => [d.id, d.data()]));
  console.log("\n== Staff");
  for (const d of staffSnap.docs) {
    const s = d.data();
    if (s.deleted) continue;
    const h = health.get(d.id) ?? [...health.values()].find((x) => x.staffId === d.id);
    console.log(`\n-- ${s.name} (${s.staffCode}) active=${s.active} shift=${s.shiftId} fences=${JSON.stringify(s.geofenceIds)}`);
    console.log(`   device bound: ${s.deviceId ? "yes" : "NO"} at ${s.deviceBoundAt ?? "-"} · consent ${s.consentAt ?? "NO"}`);
    if (h) {
      console.log(
        `   health: lastSync ${h.lastSync} reported ${h.reportedAt} · location ${h.locationPermission} · gps ${h.gpsEnabled} · batteryOptimised ${h.batteryOptimised} · notifications ${h.notificationsEnabled} · mock ${h.mockLocationDetected} · app ${h.appVersion} · ${h.manufacturer} ${h.model} Android ${h.osVersion}`,
      );
      const extra = Object.keys(h).filter((k) => !["staffId", "deviceId", "lastSync", "locationPermission", "gpsEnabled", "batteryOptimised", "notificationsEnabled", "mockLocationDetected", "rooted", "appVersion", "osVersion", "manufacturer", "model", "reportedAt"].includes(k));
      if (extra.length) console.log("   health extra:", JSON.stringify(Object.fromEntries(extra.map((k) => [k, h[k]]))));
    } else console.log("   health: NEVER REPORTED");
    const ev = await db.collection(COL.events).where("staffId", "==", d.id).get();
    const events = ev.docs.map((e) => e.data()).sort((a, b) => String(b.deviceTime).localeCompare(String(a.deviceTime)));
    console.log(`   events: ${events.length}`);
    for (const e of events.slice(0, 8)) {
      console.log(
        `     ${e.deviceTime} ${e.type} ${e.source}/${e.trigger} ${e.status}${e.rejectReason ? ` (${e.rejectReason})` : ""} dist=${e.distanceM ?? "-"}m acc=${e.accuracyM ?? "-"} inside=${e.insideGeofence} flags=${(e.flags ?? []).join("|")}`,
      );
    }
  }

  console.log("\n== Latest crash reports");
  for (const c of crashSnap.docs) {
    const r = c.data();
    console.log(`${r.receivedAt} ${r.kind} app ${r.appVersion} ${r.device} ${r.os}: ${String(r.details).slice(0, 300).replace(/\s+/g, " ")}`);
  }
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
