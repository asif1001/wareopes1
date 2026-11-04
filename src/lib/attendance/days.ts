import { cacheChangedAt } from "./cache";
import type { AttendanceRules } from "./config";
import { getMonthLockState } from "./locks";
import { computeDay, dayTypeOf, shiftWindows } from "./rules";
import { COL, dayId, getHolidaySet, getRules, getShift, type Db } from "./store";
import { localDateOf, monthOf } from "./time";
import type { AttendanceDay, AttendanceEvent, Correction, LocalDate, Shift, Staff } from "./types";

export type RecomputeOptions = {
  rules?: AttendanceRules;
  shift?: Shift;
  /** Recompute even when the month is locked (admin unlock flows only). */
  ignoreLock?: boolean;
  /** The stored day, when the caller has already read it. */
  existing?: AttendanceDay | null;
};

/**
 * Rebuild `attDays/{staffId}_{date}` from that day's events and corrections.
 * Locked months are never rewritten.
 */
export async function recomputeDay(
  db: Db,
  staff: Staff,
  date: LocalDate,
  now: Date,
  options: RecomputeOptions = {},
): Promise<AttendanceDay | null> {
  const rules = options.rules ?? (await getRules(db));
  const ref = db.collection(COL.days).doc(dayId(staff.id, date));
  let existing = options.existing;
  if (existing === undefined) {
    const existingSnap = await ref.get();
    existing = existingSnap.exists ? (existingSnap.data() as AttendanceDay) : null;
  }

  if (!options.ignoreLock) {
    const lock = await getMonthLockState(db, monthOf(date), rules, now);
    if (lock.locked) return existing;
  }

  const shift = options.shift ?? (await getShift(db, staff.shiftId));
  const [holidays, eventsSnap, correctionsSnap, leaveSnap] = await Promise.all([
    getHolidaySet(db, date, date),
    db.collection(COL.events).where("staffId", "==", staff.id).where("attendanceDate", "==", date).get(),
    db.collection(COL.corrections).where("staffId", "==", staff.id).where("date", "==", date).get(),
    // Approved leave requests list the days they cover as `${staffId}_${date}`.
    db.collection(COL.requests).where("leaveKeys", "array-contains", dayId(staff.id, date)).limit(1).get(),
  ]);

  const dayType = dayTypeOf(date, rules, holidays);
  const result = computeDay({
    date,
    shift,
    rules,
    dayType,
    events: eventsSnap.docs.map((d) => ({ ...(d.data() as AttendanceEvent), id: d.id })),
    leave: !leaveSnap.empty,
    corrections: correctionsSnap.docs.map((d) => ({ ...(d.data() as Correction), id: d.id })),
    now,
  });

  const day: AttendanceDay = {
    ...result.effective,
    id: ref.id,
    staffId: staff.id,
    contractorId: staff.contractorId,
    supervisorId: staff.supervisorId,
    date,
    month: monthOf(date),
    dayType,
    shiftId: shift.id,
    firstInEventId: result.firstInEventId,
    lastOutEventId: result.lastOutEventId,
    computed: result.computed,
    leave: result.effective.status === "LEAVE",
    staffComments: existing?.staffComments ?? [],
    updatedAt: now.toISOString(),
  };
  await ref.set(day);
  return day;
}

/**
 * A stored day only goes out of date by itself when the IN window or the OUT window closes
 * (that is when "pending" becomes "missing"); new events and corrections recompute it at once.
 * It is also rebuilt after any change to rules, shifts, holidays or staff records.
 */
export function dayIsCurrent(day: AttendanceDay, shift: Shift, rules: AttendanceRules, now: Date, configChangedAt: string) {
  if (!day.updatedAt || day.shiftId !== shift.id) return false;
  if (configChangedAt && day.updatedAt < configChangedAt) return false;
  const computedAt = Date.parse(day.updatedAt);
  const w = shiftWindows(day.date, shift, rules);
  return ![w.inClose, w.outClose].some((edge) => computedAt < edge.getTime() && edge.getTime() <= now.getTime());
}

/** Make sure every active staff member has an up-to-date day record for `date` (used by cron and the exception list). */
export async function ensureDays(db: Db, staffList: Staff[], date: LocalDate, now: Date, rules?: AttendanceRules) {
  const r = rules ?? (await getRules(db));
  if (date > localDateOf(now, r.timezone)) return [];
  const changedAt = await cacheChangedAt(db);
  const shifts = new Map<string, Shift>();
  const days: AttendanceDay[] = [];
  for (const staff of staffList) {
    if (!staff.active || !staff.shiftId) continue;
    let shift = shifts.get(staff.shiftId);
    if (!shift) {
      shift = await getShift(db, staff.shiftId);
      shifts.set(staff.shiftId, shift);
    }
    const snap = await db.collection(COL.days).doc(dayId(staff.id, date)).get();
    const existing = snap.exists ? (snap.data() as AttendanceDay) : null;
    if (existing && dayIsCurrent(existing, shift, r, now, changedAt)) {
      days.push(existing);
      continue;
    }
    const day = await recomputeDay(db, staff, date, now, { rules: r, shift, existing });
    if (day) days.push(day);
  }
  return days;
}
