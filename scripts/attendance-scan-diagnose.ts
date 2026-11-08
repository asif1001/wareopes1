/**
 * Read-only: what reached the server from gate stations and QR scans recently.
 *   npx tsx scripts/attendance-scan-diagnose.ts [days]
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

(async () => {
  const days = Number(process.argv[2] ?? 5);
  const { getAdminDb } = await import("../src/lib/firebase/admin");
  const db = await getAdminDb();
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const staffSnap = await db.collection("attStaff").get();
  const name = new Map(staffSnap.docs.map((d) => [d.id, String(d.get("name"))]));

  const ev = await db.collection("attEvents").where("receivedAt", ">=", since).get();
  const bySource: Record<string, number> = {};
  const scans: string[] = [];
  for (const d of ev.docs) {
    const e = d.data();
    const k = `${e.source}/${e.trigger}/${e.status}`;
    bySource[k] = (bySource[k] ?? 0) + 1;
    if (e.source === "STATION" || e.source === "QR" || e.trigger === "QR_SCAN" || e.trigger === "STATION_SCAN" || (e.flags ?? []).includes("QR_INVALID")) {
      scans.push(`${e.receivedAt} ${name.get(e.staffId) ?? e.staffId} ${e.type} ${e.source}/${e.trigger} ${e.status} ${e.rejectReason ?? ""} site=${e.geofenceId ?? "-"}`);
    }
  }
  console.log(`Events since ${since}: ${ev.size}`);
  console.log(bySource);
  console.log(`QR / station records (${scans.length}):`);
  for (const s of scans.sort()) console.log("  " + s);

  const health = await db.collection("attDeviceHealth").get();
  const versions: Record<string, string[]> = {};
  for (const d of health.docs) {
    const v = String(d.get("appVersion") ?? "?") + (d.get("platform") === "web" ? " (web)" : "");
    (versions[v] ??= []).push(name.get(d.id) ?? d.id);
  }
  console.log("App versions:", Object.fromEntries(Object.entries(versions).map(([v, n]) => [v, n.length])));

  const sites = await db.collection("attGeofences").get();
  for (const s of sites.docs) console.log(`Site ${s.get("name")} active=${s.get("active")} gateScreen=${!!s.get("gateKey")} staff=${staffSnap.docs.filter((d) => (d.get("geofenceIds") ?? []).includes(s.id)).length}`);

  const audit = await db.collection("attAudit").where("at", ">=", since).get().catch(() => null);
  if (audit) {
    const gate = audit.docs.map((d) => d.data()).filter((a) => String(a.what).startsWith("GATE_"));
    console.log(`Gate link opens/renewals: ${gate.length}`);
    for (const a of gate) console.log(`  ${a.at} ${a.what} site=${a.entityId} by=${a.who}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
