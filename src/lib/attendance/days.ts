import type { AttendanceRules } from "./config";
import { getMonthLockState } from "./locks";
import { computeDay, dayTypeOf } from "./rules";
import { COL, dayId, getHolidaySet, getRules, getShift, type Db } from "./store";
import { localDateOf, monthOf } from "./time";
import type { AttendanceDay, AttendanceEvent, Correction, LocalDate, Shift, Staff } from "./types";

export type RecomputeOptions = {
  rules?: AttendanceRules;
  shift?: Shift;
  /** Recompute even when the month is locked (admin unlock flows only). */
  ignoreLock?: boolean;
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
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? (existingSnap.data() as AttendanceDay) : null;

  if (!options.ignoreLock) {
    const lock = await getMonthLockState(db, monthOf(date), rules, now);
    if (lock.locked) return existing;
  }

  const shift = options.shift ?? (await getShift(db, staff.shiftId));
  const [holidays, eventsSnap, correctionsSnap] = await Promise.all([
    getHolidaySet(db, date, date),
    db.collection(COL.events).where("staffId", "==", staff.id).where("attendanceDate", "==", date).get(),
    db.collection(COL.corrections).where("staffId", "==", staff.id).where("date", "==", date).get(),
  ]);

  const dayType = dayTypeOf(date, rules, holidays);
  const result = computeDay({
    date,
    shift,
    rules,
    dayType,
    events: eventsSnap.docs.map((d) => ({ ...(d.data() as AttendanceEvent), id: d.id })),
    leave: false,
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

/** Make sure every active staff member has a day record for `date` (used by cron and the exception list). */
export async function ensureDays(db: Db, staffList: Staff[], date: LocalDate, now: Date, rules?: AttendanceRules) {
  const r = rules ?? (await getRules(db));
  if (date > localDateOf(now, r.timezone)) return [];
  const shifts = new Map<string, Shift>();
  const days: AttendanceDay[] = [];
  for (const staff of staffList) {
    if (!staff.active || !staff.shiftId) continue;
    let shift = shifts.get(staff.shiftId);
    if (!shift) {
      shift = await getShift(db, staff.shiftId);
      shifts.set(staff.shiftId, shift);
    }
    const day = await recomputeDay(db, staff, date, now, { rules: r, shift });
    if (day) days.push(day);
  }
  return days;
}
