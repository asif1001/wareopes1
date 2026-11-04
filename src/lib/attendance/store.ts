import type { Firestore } from "firebase-admin/firestore";
import { cached } from "./cache";
import { mergeRules, type AttendanceRules } from "./config";
import { notFound } from "./errors";
import type { Geofence, Holiday, LocalDate, Shift, Staff, StaffPublic } from "./types";

export type Db = Firestore;

/** All attendance data lives in these collections; clients never read them directly. */
export const COL = {
  settings: "attSettings",
  contractors: "attContractors",
  staff: "attStaff",
  staffCodes: "attStaffCodes",
  staffCpr: "attStaffCpr",
  shifts: "attShifts",
  geofences: "attGeofences",
  holidays: "attHolidays",
  events: "attEvents",
  days: "attDays",
  overtime: "attOvertime",
  corrections: "attCorrections",
  monthLocks: "attMonthLocks",
  audit: "attAudit",
  deviceHealth: "attDeviceHealth",
  consents: "attConsents",
  photos: "attPhotos",
  crashReports: "attCrashReports",
  requests: "attRequests",
  pushSubs: "attPushSubs",
  pushLog: "attPushLog",
} as const;

export const RULES_DOC = "rules";

export const dayId = (staffId: string, date: LocalDate) => `${staffId}_${date}`;
export const eventId = (staffId: string, clientEventId: string) => `${staffId}__${clientEventId}`;
export const normalizeStaffCode = (code: string) => code.trim().toUpperCase();
export const normalizeCpr = (cpr: string) => cpr.replace(/\D/g, "");

export async function getRules(db: Db): Promise<AttendanceRules> {
  return cached(db, "rules", async () => {
    const snap = await db.collection(COL.settings).doc(RULES_DOC).get();
    return mergeRules(snap.exists ? snap.data() : undefined);
  });
}

export async function getStaff(db: Db, staffId: string): Promise<Staff> {
  const snap = await db.collection(COL.staff).doc(staffId).get();
  if (!snap.exists) throw notFound("Staff not found");
  return { ...(snap.data() as Staff), id: snap.id };
}

/** All staff (cached; every write to a staff record bumps the cache version). Use getStaff for a fresh single record. */
export async function listStaff(db: Db): Promise<Staff[]> {
  return cached(db, "staff", async () => {
    const snap = await db.collection(COL.staff).get();
    return snap.docs.map((d) => ({ ...(d.data() as Staff), id: d.id }));
  });
}

export function toStaffPublic(staff: Staff): StaffPublic {
  const { pinHash: _pin, pinFailures: _f, pinLockedUntil: _l, tokenVersion: _v, ...rest } = staff;
  return rest;
}

export async function getShift(db: Db, shiftId: string): Promise<Shift> {
  const shift = (await listShifts(db)).find((s) => s.id === shiftId);
  if (!shift) throw notFound("Shift not found");
  return shift;
}

export async function listShifts(db: Db): Promise<Shift[]> {
  return cached(db, "shifts", async () => {
    const snap = await db.collection(COL.shifts).get();
    return snap.docs.map((d) => ({ ...(d.data() as Shift), id: d.id }));
  });
}

/** Every site, active or not, including server-only fields such as the gate key. */
export async function listAllGeofences(db: Db): Promise<Geofence[]> {
  return cached(db, "geofences", async () => {
    const snap = await db.collection(COL.geofences).get();
    return snap.docs.map((d) => ({ ...(d.data() as Geofence), id: d.id }));
  });
}

export async function getGeofencesFor(db: Db, staff: Pick<Staff, "geofenceIds">): Promise<Geofence[]> {
  const all = (await listAllGeofences(db)).filter((g) => g.active);
  if (!staff.geofenceIds?.length) return all;
  return all.filter((g) => staff.geofenceIds.includes(g.id));
}

export async function getHolidaySet(db: Db, from: LocalDate, to: LocalDate): Promise<Set<string>> {
  const all = await cached(db, "holidays", async () => {
    const snap = await db.collection(COL.holidays).get();
    return snap.docs.map((d) => (d.data() as Holiday).date);
  });
  return new Set(all.filter((date) => date >= from && date <= to));
}
