import { z } from "zod";
import { CONSENT_VERSION, type AttendanceRules } from "./config";
import { writeAudit } from "./audit";
import { bumpCacheVersion } from "./cache";
import { badRequest } from "./errors";
import { COL, listAllGeofences, type Db } from "./store";
import { localDateOf } from "./time";
import { haversineMeters } from "./geo";
import type { AttendanceEvent, DeviceHealth, Staff } from "./types";

export const healthSchema = z.object({
  locationPermission: z.enum(["ALWAYS", "WHILE_IN_USE", "DENIED"]),
  gpsEnabled: z.boolean(),
  batteryOptimised: z.boolean(),
  notificationsEnabled: z.boolean(),
  mockLocationDetected: z.boolean(),
  rooted: z.boolean(),
  appVersion: z.string().trim().min(1).max(32),
  osVersion: z.string().trim().max(32).default(""),
  manufacturer: z.string().trim().max(64).default(""),
  model: z.string().trim().max(64).default(""),
});

export async function reportDeviceHealth(db: Db, staff: Staff & { client?: "android" | "web" }, body: unknown, now: Date) {
  const parsed = healthSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Invalid device health report");
  const health: DeviceHealth = {
    ...parsed.data,
    platform: staff.client === "web" ? "web" : "android",
    staffId: staff.id,
    deviceId: staff.deviceId ?? "",
    lastSync: now.toISOString(),
    reportedAt: now.toISOString(),
  };
  await db.collection(COL.deviceHealth).doc(staff.id).set(health, { merge: true });
  return health;
}

export type DeviceIssue =
  | "NO_DATA"
  | "NO_SYNC"
  | "LOCATION_NOT_ALWAYS"
  | "GPS_OFF"
  | "BATTERY_OPTIMISED"
  | "NOTIFICATIONS_OFF"
  | "MOCK_APP"
  | "ROOTED"
  | "APP_OUTDATED"
  | "NO_ACTIVE_SITE"
  | "FAR_FROM_SITE";

/** A tap this far outside every assigned site usually means a wrong site pin. */
export const FAR_FROM_SITE_M = 1000;
/** From this Android app version on there is no background recording. */
const FIRST_MANUAL_APP_VERSION = "1.2.0";
const FAR_LOOKBACK_MS = 3 * 24 * 3600 * 1000;

/**
 * Site problems that stop check-in even when the phone is fine: the staff member has no
 * active site, or their latest location (last 3 days) is far from every site — usually a
 * wrong pin. The latest location is kept on the device-health record at every sync; only
 * phones that have not synced since that was added fall back to reading their events.
 */
export async function siteIssuesByStaff(
  db: Db,
  staff: Pick<Staff, "id" | "geofenceIds">[],
  now: Date,
  health?: Map<string, Partial<DeviceHealth>>,
): Promise<Map<string, DeviceIssue[]>> {
  const since = new Date(now.getTime() - FAR_LOOKBACK_MS).toISOString();
  const healthById =
    health ??
    new Map((await db.collection(COL.deviceHealth).get()).docs.map((d) => [d.id, d.data() as Partial<DeviceHealth>]));
  const active = (await listAllGeofences(db)).filter((g) => g.active);
  const lookbackDates = [0, 1, 2, 3].map((n) => localDateOf(new Date(now.getTime() - n * 86400000), "UTC"));

  const latestFix = async (staffId: string): Promise<{ lat: number; lng: number; at: string } | null> => {
    const h = healthById.get(staffId);
    if (h?.fixTracked) return h.lastFix && h.lastFix.at >= since ? h.lastFix : null;
    const snap = await db.collection(COL.events).where("staffId", "==", staffId).where("attendanceDate", "in", lookbackDates).get();
    let best: AttendanceEvent | null = null;
    for (const d of snap.docs) {
      const e = d.data() as AttendanceEvent;
      if (e.lat == null || e.lng == null || e.receivedAt < since) continue;
      if (!best || e.deviceTime > best.deviceTime) best = e;
    }
    return best ? { lat: best.lat!, lng: best.lng!, at: best.deviceTime } : null;
  };

  const out = new Map<string, DeviceIssue[]>();
  for (const s of staff) {
    const fences = s.geofenceIds?.length ? active.filter((g) => s.geofenceIds.includes(g.id)) : active;
    const issues: DeviceIssue[] = [];
    if (!fences.length) issues.push("NO_ACTIVE_SITE");
    const fix = fences.length ? await latestFix(s.id) : null;
    if (fix && fences.every((g) => haversineMeters(fix.lat, fix.lng, g.lat, g.lng) - g.radiusM > FAR_FROM_SITE_M)) {
      issues.push("FAR_FROM_SITE");
    }
    out.set(s.id, issues);
  }
  return out;
}
/** Compare dotted versions ("1.2.10" > "1.2.9"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

export function deviceIssues(health: Partial<DeviceHealth> | null, rules: AttendanceRules, now: Date): DeviceIssue[] {
  if (!health || !health.reportedAt) return ["NO_DATA"];
  const issues: DeviceIssue[] = [];
  const lastSync = health.lastSync ? new Date(health.lastSync).getTime() : 0;
  // The iPhone page and app 1.2+ never record in the background (staff tap or scan), so
  // background settings — and long gaps between syncs — do not matter for them.
  const web = health.platform === "web";
  const background = !web && !!health.appVersion && compareVersions(health.appVersion, FIRST_MANUAL_APP_VERSION) < 0;
  if (background && now.getTime() - lastSync > rules.noSyncAlertHours * 3600000) issues.push("NO_SYNC");
  if (background && health.locationPermission !== "ALWAYS") issues.push("LOCATION_NOT_ALWAYS");
  if (background && health.gpsEnabled === false) issues.push("GPS_OFF");
  if (background && health.batteryOptimised) issues.push("BATTERY_OPTIMISED");
  if (health.notificationsEnabled === false) issues.push("NOTIFICATIONS_OFF");
  if (health.mockLocationDetected) issues.push("MOCK_APP");
  if (health.rooted) issues.push("ROOTED");
  if (!web && health.appVersion && compareVersions(health.appVersion, rules.minAppVersion) < 0) issues.push("APP_OUTDATED");
  return issues;
}

const consentSchema = z.object({ version: z.string().min(1).max(32), accepted: z.literal(true) });

/** Store the staff member's consent to location recording, with a timestamp. */
export async function recordConsent(db: Db, staff: Staff, body: unknown, now: Date) {
  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Consent must be accepted");
  if (parsed.data.version !== CONSENT_VERSION) throw badRequest("Please update the app to accept the latest terms");
  const record = {
    staffId: staff.id,
    deviceId: staff.deviceId,
    version: parsed.data.version,
    acceptedAt: now.toISOString(),
  };
  await db.collection(COL.consents).add(record);
  await db.collection(COL.staff).doc(staff.id).update({ consentAt: record.acceptedAt, consentVersion: record.version });
  await bumpCacheVersion(db);
  await writeAudit(db, { who: `staff:${staff.id}`, what: "CONSENT_ACCEPTED", entity: COL.staff, entityId: staff.id, before: null, after: record }, now);
  return record;
}
