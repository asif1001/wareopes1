import type { AttendanceRules, RateType, RoundingMode } from "./config";
import {
  addDays,
  addMinutes,
  localDateOf,
  localTimeOf,
  minutesBetween,
  parseTimeOfDay,
  weekdayOf,
  zonedToUtc,
} from "./time";
import type {
  AttendanceEvent,
  Correction,
  CorrectionField,
  DayFlag,
  DayStatus,
  DayType,
  DayValues,
  EventFlag,
  LocalDate,
  Shift,
} from "./types";

export type ShiftWindows = {
  date: LocalDate;
  start: Date;
  end: Date;
  /** IN window: start − graceBefore … start + graceAfter */
  inOpen: Date;
  inClose: Date;
  /** OUT window: end − graceBefore … end + graceAfter */
  outOpen: Date;
  outClose: Date;
  /** An IN after this instant is LATE */
  lateAfter: Date;
  /** Earliest OT_IN on a workday */
  otAllowedFrom: Date;
};

export function shiftCrossesMidnight(shift: Pick<Shift, "startTime" | "endTime" | "crossesMidnight">) {
  const start = parseTimeOfDay(shift.startTime);
  const end = parseTimeOfDay(shift.endTime);
  return shift.crossesMidnight || end.hour * 60 + end.minute <= start.hour * 60 + start.minute;
}

export function shiftWindows(date: LocalDate, shift: Shift, rules: AttendanceRules): ShiftWindows {
  const start = zonedToUtc(date, shift.startTime, rules.timezone);
  const endDate = shiftCrossesMidnight(shift) ? addDays(date, 1) : date;
  const end = zonedToUtc(endDate, shift.endTime, rules.timezone);
  const before = shift.graceBeforeMin;
  const after = shift.graceAfterMin;
  return {
    date,
    start,
    end,
    inOpen: addMinutes(start, -before),
    inClose: addMinutes(start, after),
    outOpen: addMinutes(end, -before),
    outClose: addMinutes(end, after),
    lateAfter: rules.lateThreshold === "AFTER_GRACE" ? addMinutes(start, after) : start,
    otAllowedFrom: addMinutes(end, rules.otStartAfterShiftEndMin),
  };
}

/**
 * The attendance day runs from the IN window opening of that day's shift to
 * the IN window opening of the next day's shift, so night shifts and OT that
 * runs past midnight land on the day the shift started.
 */
export function attendanceDateFor(instant: Date, shift: Shift, rules: AttendanceRules): LocalDate {
  const local = localDateOf(instant, rules.timezone);
  const windows = shiftWindows(local, shift, rules);
  return instant.getTime() >= windows.inOpen.getTime() ? local : addDays(local, -1);
}

export function dayTypeOf(date: LocalDate, rules: AttendanceRules, holidayDates: ReadonlySet<string>): DayType {
  if (holidayDates.has(date)) return "HOLIDAY";
  if (rules.weeklyOffDays.includes(weekdayOf(date))) return "WEEKLY_OFF";
  return "WORKDAY";
}

export function rateTypeFor(date: LocalDate, dayType: DayType, rules: AttendanceRules): RateType {
  if (dayType === "HOLIDAY") return rules.holidayRateType;
  if (dayType === "WEEKLY_OFF") {
    return rules.offDayRateTypes[String(weekdayOf(date))] ?? rules.workdayRateType;
  }
  return rules.workdayRateType;
}

export function roundMinutes(minutes: number, step: number, mode: RoundingMode): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  const units = minutes / step;
  const rounded =
    mode === "DOWN" ? Math.floor(units + 1e-9) : mode === "UP" ? Math.ceil(units - 1e-9) : Math.round(units);
  return rounded * step;
}

// ---------------------------------------------------------------------------
// Attendance day
// ---------------------------------------------------------------------------

export type DayInput = {
  date: LocalDate;
  shift: Shift;
  rules: AttendanceRules;
  dayType: DayType;
  /** All events mapped to this attendance date, any status */
  events: AttendanceEvent[];
  leave: boolean;
  corrections: Correction[];
  now: Date;
};

export type DayResult = {
  computed: DayValues;
  effective: DayValues;
  firstInEventId: string | null;
  lastOutEventId: string | null;
};

type Picked = {
  firstIn: AttendanceEvent | null;
  lastOut: AttendanceEvent | null;
  earlyOut: boolean;
};

const EVENT_TO_DAY_FLAGS: Partial<Record<EventFlag, DayFlag>> = {
  MOCK_LOCATION: "MOCK_LOCATION",
  ROOTED: "ROOTED",
  POOR_ACCURACY: "POOR_ACCURACY",
  OUTSIDE_GEOFENCE: "OUTSIDE_GEOFENCE",
  CLOCK_DRIFT: "CLOCK_DRIFT",
};

function time(event: AttendanceEvent) {
  return new Date(event.effectiveTime).getTime();
}

function pickTimes(events: AttendanceEvent[], windows: ShiftWindows, rules: AttendanceRules): Picked {
  const accepted = events
    .filter((e) => e.status === "ACCEPTED" && (e.type === "IN" || e.type === "OUT"))
    .sort((a, b) => time(a) - time(b));

  const firstIn =
    accepted.find(
      (e) => e.type === "IN" && time(e) >= windows.inOpen.getTime() && time(e) < windows.end.getTime(),
    ) ?? null;

  const outs = accepted.filter((e) => e.type === "OUT" && (!firstIn || time(e) > time(firstIn)));
  const inWindow = outs.filter((e) => time(e) >= windows.outOpen.getTime());
  if (inWindow.length) return { firstIn, lastOut: inWindow[inWindow.length - 1], earlyOut: false };

  if (rules.earlyOutPolicy === "FLAG_EARLY_OUT" && firstIn && outs.length) {
    return { firstIn, lastOut: outs[outs.length - 1], earlyOut: true };
  }
  return { firstIn, lastOut: null, earlyOut: false };
}

type EvaluateInput = {
  windows: ShiftWindows;
  shift: Shift;
  rules: AttendanceRules;
  dayType: DayType;
  firstIn: Date | null;
  lastOut: Date | null;
  earlyOut: boolean;
  leave: boolean;
  hasAnyEvent: boolean;
  now: Date;
  baseFlags: DayFlag[];
};

function evaluate(input: EvaluateInput): DayValues {
  const { windows, rules, shift, firstIn, lastOut, now } = input;
  const flags = new Set<DayFlag>(input.baseFlags);
  const values = (status: DayStatus, regularMinutes = 0): DayValues => ({
    firstIn: firstIn ? firstIn.toISOString() : null,
    lastOut: lastOut ? lastOut.toISOString() : null,
    regularMinutes,
    status,
    flags: Array.from(flags).sort(),
  });

  if (input.leave) return values("LEAVE");

  if (input.dayType !== "WORKDAY" && rules.offDayWorkIsOvertime) {
    if (input.hasAnyEvent) flags.add("OFF_DAY_WORK");
    return values("OFF");
  }

  const late = !!firstIn && firstIn.getTime() > windows.lateAfter.getTime();
  if (late) flags.add("LATE");
  if (input.earlyOut) flags.add("EARLY_OUT");

  if (!firstIn && !lastOut) {
    if (now.getTime() >= windows.outClose.getTime()) {
      flags.add("MISSING_IN");
      return values("ABSENT");
    }
    if (now.getTime() >= windows.inClose.getTime()) {
      flags.add("MISSING_IN");
      return values("MISSING_IN");
    }
    return values("PENDING");
  }

  if (!firstIn) {
    flags.add("MISSING_IN");
    return values("MISSING_IN");
  }

  if (!lastOut) {
    if (now.getTime() >= windows.outClose.getTime()) {
      flags.add("MISSING_OUT");
      return values("MISSING_OUT");
    }
    return values("PENDING");
  }

  const paidFrom =
    !late && rules.payFromShiftStartWhenOnTime
      ? windows.start
      : new Date(Math.max(firstIn.getTime(), windows.start.getTime()));
  const outInWindow = lastOut.getTime() >= windows.outOpen.getTime();
  const paidTo =
    outInWindow && rules.payToShiftEndWhenInWindow
      ? windows.end
      : new Date(Math.min(lastOut.getTime(), windows.end.getTime()));
  const raw = Math.max(0, minutesBetween(paidFrom, paidTo) - shift.breakMinutes);
  const regular = roundMinutes(raw, rules.roundingStepMin, rules.roundingMode);
  return values(late ? "LATE" : "PRESENT", regular);
}

function latestCorrections(corrections: Correction[]) {
  const latest = new Map<CorrectionField, Correction>();
  for (const c of [...corrections].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    latest.set(c.field, c);
  }
  return latest;
}

export function computeDay(input: DayInput): DayResult {
  const windows = shiftWindows(input.date, input.shift, input.rules);
  const picked = pickTimes(input.events, windows, input.rules);
  const accepted = input.events.filter((e) => e.status === "ACCEPTED");

  const flagsFrom = (events: (AttendanceEvent | null)[]) => {
    const flags = new Set<DayFlag>();
    for (const e of accepted) {
      if (e.flags.includes("MOCK_LOCATION")) flags.add("MOCK_LOCATION");
      if (e.flags.includes("ROOTED")) flags.add("ROOTED");
    }
    for (const e of events) {
      if (!e) continue;
      for (const f of e.flags) {
        const mapped = EVENT_TO_DAY_FLAGS[f];
        if (mapped) flags.add(mapped);
      }
    }
    return flags;
  };

  const computedFlags = flagsFrom([picked.firstIn, picked.lastOut]);
  if (picked.firstIn?.source === "MANUAL") computedFlags.add("MANUAL_IN");

  const base = {
    windows,
    shift: input.shift,
    rules: input.rules,
    dayType: input.dayType,
    hasAnyEvent: accepted.length > 0,
    now: input.now,
  };

  const computed = evaluate({
    ...base,
    firstIn: picked.firstIn ? new Date(picked.firstIn.effectiveTime) : null,
    lastOut: picked.lastOut ? new Date(picked.lastOut.effectiveTime) : null,
    earlyOut: picked.earlyOut,
    leave: input.leave,
    baseFlags: Array.from(computedFlags),
  });

  const result: DayResult = {
    computed,
    effective: computed,
    firstInEventId: picked.firstIn?.id ?? null,
    lastOutEventId: picked.lastOut?.id ?? null,
  };

  const corrections = latestCorrections(input.corrections);
  if (!corrections.size) return result;

  const inCorrection = corrections.get("firstIn");
  const outCorrection = corrections.get("lastOut");
  const leaveCorrection = corrections.get("leave");
  const statusCorrection = corrections.get("status");

  const firstIn = inCorrection
    ? toDate(inCorrection.newValue)
    : picked.firstIn
      ? new Date(picked.firstIn.effectiveTime)
      : null;
  const lastOut = outCorrection
    ? toDate(outCorrection.newValue)
    : picked.lastOut
      ? new Date(picked.lastOut.effectiveTime)
      : null;

  const flags = flagsFrom([inCorrection ? null : picked.firstIn, outCorrection ? null : picked.lastOut]);
  if (!inCorrection && picked.firstIn?.source === "MANUAL") flags.add("MANUAL_IN");
  flags.add("CORRECTED");

  const effective = evaluate({
    ...base,
    firstIn,
    lastOut,
    earlyOut: outCorrection ? false : picked.earlyOut,
    leave: leaveCorrection ? leaveCorrection.newValue === true : input.leave,
    baseFlags: Array.from(flags),
  });
  if (statusCorrection && typeof statusCorrection.newValue === "string") {
    effective.status = statusCorrection.newValue as DayStatus;
  }
  result.effective = effective;
  return result;
}

function toDate(value: string | boolean | null): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Overtime
// ---------------------------------------------------------------------------

export type OtCheck = { ok: true } | { ok: false; code: "OT_TOO_EARLY" | "OUTSIDE_GEOFENCE"; message: string };

export function checkOtIn(params: {
  at: Date;
  date: LocalDate;
  shift: Shift;
  rules: AttendanceRules;
  dayType: DayType;
  insideGeofence: boolean;
}): OtCheck {
  const { at, date, shift, rules, dayType } = params;
  if (dayType === "WORKDAY") {
    const { otAllowedFrom } = shiftWindows(date, shift, rules);
    if (at.getTime() < otAllowedFrom.getTime()) {
      return {
        ok: false,
        code: "OT_TOO_EARLY",
        message: `Overtime can only start from ${localTimeOf(otAllowedFrom, rules.timezone)} (${rules.otStartAfterShiftEndMin} min after your shift ends).`,
      };
    }
  }
  if (!params.insideGeofence) {
    return {
      ok: false,
      code: "OUTSIDE_GEOFENCE",
      message: "You must be inside the warehouse area to start overtime.",
    };
  }
  return { ok: true };
}

/** When an OT with no OT_OUT is closed automatically. */
export function otAutoCloseAt(otIn: Date, rules: AttendanceRules): Date {
  let cutoff = addMinutes(otIn, rules.otAutoCloseAfterMin);
  if (rules.otAutoCloseAtLocal) {
    const wall = zonedToUtc(localDateOf(otIn, rules.timezone), rules.otAutoCloseAtLocal, rules.timezone);
    if (wall.getTime() > otIn.getTime() && wall.getTime() < cutoff.getTime()) cutoff = wall;
  }
  return cutoff;
}

export function otMinutes(otIn: Date, otOut: Date, rules: AttendanceRules): number {
  return roundMinutes(minutesBetween(otIn, otOut), rules.roundingStepMin, rules.roundingMode);
}
