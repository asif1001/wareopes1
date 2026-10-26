import { z } from "zod";
import { CONSENT_VERSION, type AttendanceRules } from "./config";
import { writeAudit } from "./audit";
import { badRequest } from "./errors";
import { COL, type Db } from "./store";
import type { DeviceHealth, Staff } from "./types";

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

export async function reportDeviceHealth(db: Db, staff: Staff, body: unknown, now: Date) {
  const parsed = healthSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Invalid device health report");
  const health: DeviceHealth = {
    ...parsed.data,
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
  | "APP_OUTDATED";

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
  if (now.getTime() - lastSync > rules.noSyncAlertHours * 3600000) issues.push("NO_SYNC");
  if (health.locationPermission !== "ALWAYS") issues.push("LOCATION_NOT_ALWAYS");
  if (health.gpsEnabled === false) issues.push("GPS_OFF");
  if (health.batteryOptimised) issues.push("BATTERY_OPTIMISED");
  if (health.notificationsEnabled === false) issues.push("NOTIFICATIONS_OFF");
  if (health.mockLocationDetected) issues.push("MOCK_APP");
  if (health.rooted) issues.push("ROOTED");
  if (health.appVersion && compareVersions(health.appVersion, rules.minAppVersion) < 0) issues.push("APP_OUTDATED");
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
  await writeAudit(db, { who: `staff:${staff.id}`, what: "CONSENT_ACCEPTED", entity: COL.staff, entityId: staff.id, before: null, after: record }, now);
  return record;
}
