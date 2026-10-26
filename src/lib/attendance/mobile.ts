import { CONSENT_VERSION } from "./config";
import { dayTypeOf, shiftWindows } from "./rules";
import { COL, dayId, getGeofencesFor, getHolidaySet, getRules, getShift, type Db } from "./store";
import { addDays, isValidMonth, localDateOf } from "./time";
import type { AttendanceDay, OvertimeRequest, Staff } from "./types";

const CALENDAR_DAYS = 14;

/**
 * Everything the phone needs to work offline for the next two weeks: the
 * geofences and, per date, the exact UTC instants of each window, so the app
 * never has to do timezone or holiday logic itself.
 */
export async function getMobileProfile(db: Db, staff: Staff, now: Date) {
  const rules = await getRules(db);
  const shift = await getShift(db, staff.shiftId);
  const geofences = await getGeofencesFor(db, staff);
  const today = localDateOf(now, rules.timezone);
  const from = addDays(today, -1);
  const to = addDays(today, CALENDAR_DAYS);
  const holidays = await getHolidaySet(db, from, to);

  const calendar = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const dayType = dayTypeOf(date, rules, holidays);
    const w = shiftWindows(date, shift, rules);
    calendar.push({
      date,
      dayType,
      start: w.start.toISOString(),
      end: w.end.toISOString(),
      inOpen: w.inOpen.toISOString(),
      inClose: w.inClose.toISOString(),
      outOpen: w.outOpen.toISOString(),
      outClose: w.outClose.toISOString(),
      otAllowedFrom: dayType === "WORKDAY" ? w.otAllowedFrom.toISOString() : null,
    });
  }

  const [todaySnap, openSnap] = await Promise.all([
    db.collection(COL.days).doc(dayId(staff.id, today)).get(),
    db.collection(COL.overtime).where("staffId", "==", staff.id).where("otOut", "==", null).get(),
  ]);

  return {
    staff: { id: staff.id, staffCode: staff.staffCode, name: staff.name },
    shift: {
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      crossesMidnight: shift.crossesMidnight,
      graceBeforeMin: shift.graceBeforeMin,
      graceAfterMin: shift.graceAfterMin,
    },
    geofences: geofences.map((g) => ({ id: g.id, name: g.name, lat: g.lat, lng: g.lng, radiusM: g.radiusM })),
    rules: {
      timezone: rules.timezone,
      otStartAfterShiftEndMin: rules.otStartAfterShiftEndMin,
      otAutoCloseAfterMin: rules.otAutoCloseAfterMin,
      otAutoCloseAtLocal: rules.otAutoCloseAtLocal,
      poorAccuracyM: rules.poorAccuracyM,
    },
    calendar,
    today: todaySnap.exists ? (todaySnap.data() as AttendanceDay) : null,
    openOvertime: openSnap.empty ? null : ({ ...openSnap.docs[0].data(), id: openSnap.docs[0].id } as OvertimeRequest),
    consent: { required: staff.consentVersion !== CONSENT_VERSION, version: CONSENT_VERSION, acceptedAt: staff.consentAt },
    app: appVersionInfo(rules),
    serverTime: now.toISOString(),
  };
}

export function appVersionInfo(rules: { latestAppVersion: string; minAppVersion: string; apkUrl: string; apkSha256: string }) {
  return {
    latestVersion: rules.latestAppVersion,
    minVersion: rules.minAppVersion,
    apkUrl: rules.apkUrl,
    apkSha256: rules.apkSha256,
  };
}

/** The staff member's own days and overtime for a month. */
export async function getStaffHistory(db: Db, staff: Staff, month: string) {
  if (!isValidMonth(month)) return { month, days: [], overtime: [] };
  const [days, overtime] = await Promise.all([
    db.collection(COL.days).where("staffId", "==", staff.id).where("month", "==", month).get(),
    db.collection(COL.overtime).where("staffId", "==", staff.id).where("month", "==", month).get(),
  ]);
  const strip = (d: AttendanceDay) => ({
    date: d.date,
    status: d.status,
    firstIn: d.firstIn,
    lastOut: d.lastOut,
    regularMinutes: d.regularMinutes,
    flags: d.flags,
    staffComments: d.staffComments,
  });
  return {
    month,
    days: days.docs.map((d) => strip(d.data() as AttendanceDay)).sort((a, b) => a.date.localeCompare(b.date)),
    overtime: overtime.docs
      .map((d) => {
        const o = d.data() as OvertimeRequest;
        return { id: d.id, date: o.date, otIn: o.otIn, otOut: o.otOut, minutes: o.minutes, status: o.status, rateType: o.rateType };
      })
      .sort((a, b) => a.otIn.localeCompare(b.otIn)),
  };
}
