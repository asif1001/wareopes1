import type { Firestore } from "firebase-admin/firestore";
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
  const snap = await db.collection(COL.settings).doc(RULES_DOC).get();
  return mergeRules(snap.exists ? snap.data() : undefined);
}

export async function getStaff(db: Db, staffId: string): Promise<Staff> {
  const snap = await db.collection(COL.staff).doc(staffId).get();
  if (!snap.exists) throw notFound("Staff not found");
  return { ...(snap.data() as Staff), id: snap.id };
}

export async function listStaff(db: Db): Promise<Staff[]> {
  const snap = await db.collection(COL.staff).get();
  return snap.docs.map((d) => ({ ...(d.data() as Staff), id: d.id }));
}

export function toStaffPublic(staff: Staff): StaffPublic {
  const { pinHash: _pin, pinFailures: _f, pinLockedUntil: _l, tokenVersion: _v, ...rest } = staff;
  return rest;
}

export async function getShift(db: Db, shiftId: string): Promise<Shift> {
  const snap = await db.collection(COL.shifts).doc(shiftId).get();
  if (!snap.exists) throw notFound("Shift not found");
  return { ...(snap.data() as Shift), id: snap.id };
}

export async function listShifts(db: Db): Promise<Shift[]> {
  const snap = await db.collection(COL.shifts).get();
  return snap.docs.map((d) => ({ ...(d.data() as Shift), id: d.id }));
}

export async function getGeofencesFor(db: Db, staff: Pick<Staff, "geofenceIds">): Promise<Geofence[]> {
  const snap = await db.collection(COL.geofences).get();
  const all = snap.docs.map((d) => ({ ...(d.data() as Geofence), id: d.id })).filter((g) => g.active);
  if (!staff.geofenceIds?.length) return all;
  return all.filter((g) => staff.geofenceIds.includes(g.id));
}

export async function getHolidaySet(db: Db, from: LocalDate, to: LocalDate): Promise<Set<string>> {
  const snap = await db.collection(COL.holidays).where("date", ">=", from).where("date", "<=", to).get();
  return new Set(snap.docs.map((d) => (d.data() as Holiday).date));
}
