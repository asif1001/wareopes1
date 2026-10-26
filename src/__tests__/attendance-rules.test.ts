import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type AttendanceRules } from "@/lib/attendance/config";
import {
  attendanceDateFor,
  checkOtIn,
  computeDay,
  dayTypeOf,
  otAutoCloseAt,
  otMinutes,
  rateTypeFor,
  roundMinutes,
  shiftWindows,
} from "@/lib/attendance/rules";
import { localDateOf, zonedToUtc } from "@/lib/attendance/time";
import type { AttendanceEvent, Correction, EventType, Shift } from "@/lib/attendance/types";

const rules: AttendanceRules = { ...DEFAULT_RULES, weeklyOffDays: [5] };

const dayShift: Shift = {
  id: "day",
  name: "Day",
  startTime: "07:00",
  endTime: "16:00",
  crossesMidnight: false,
  graceBeforeMin: 15,
  graceAfterMin: 15,
  breakMinutes: 0,
  active: true,
};

const nightShift: Shift = { ...dayShift, id: "night", name: "Night", startTime: "22:00", endTime: "06:00" };

/** 2026-11-02 is a Monday. */
const MONDAY = "2026-11-02";
const at = (date: string, time: string) => zonedToUtc(date, time, rules.timezone);

let seq = 0;
function event(type: EventType, date: string, time: string, extra: Partial<AttendanceEvent> = {}): AttendanceEvent {
  const t = at(date, time).toISOString();
  seq += 1;
  return {
    id: `e${seq}`,
    clientEventId: `c${seq}`,
    staffId: "s1",
    deviceId: "d1",
    type,
    source: "AUTO",
    trigger: "SCHEDULED",
    deviceTime: t,
    receivedAt: t,
    clockDriftSec: 0,
    effectiveTime: t,
    attendanceDate: date,
    lat: 26.2,
    lng: 50.6,
    accuracyM: 10,
    distanceM: 5,
    geofenceId: "g1",
    insideGeofence: true,
    mockLocation: false,
    rooted: false,
    photoRef: null,
    flags: [],
    status: "ACCEPTED",
    rejectReason: null,
    ...extra,
  };
}

function day(events: AttendanceEvent[], opts: { now?: Date; corrections?: Correction[]; shift?: Shift; date?: string; r?: AttendanceRules } = {}) {
  const date = opts.date ?? MONDAY;
  const r = opts.r ?? rules;
  return computeDay({
    date,
    shift: opts.shift ?? dayShift,
    rules: r,
    dayType: dayTypeOf(date, r, new Set()),
    events,
    leave: false,
    corrections: opts.corrections ?? [],
    now: opts.now ?? at("2026-11-03", "12:00"),
  });
}

describe("time helpers", () => {
  it("converts Bahrain local time to UTC (UTC+3)", () => {
    expect(at(MONDAY, "07:00").toISOString()).toBe("2026-11-02T04:00:00.000Z");
    expect(localDateOf(new Date("2026-11-02T22:30:00Z"), rules.timezone)).toBe("2026-11-03");
  });
});

describe("shift windows", () => {
  it("builds IN/OUT windows of ±15 minutes and the OT start", () => {
    const w = shiftWindows(MONDAY, dayShift, rules);
    expect(w.inOpen).toEqual(at(MONDAY, "06:45"));
    expect(w.inClose).toEqual(at(MONDAY, "07:15"));
    expect(w.outOpen).toEqual(at(MONDAY, "15:45"));
    expect(w.outClose).toEqual(at(MONDAY, "16:15"));
    expect(w.otAllowedFrom).toEqual(at(MONDAY, "16:30"));
  });

  it("ends a midnight-crossing shift on the next calendar day", () => {
    const w = shiftWindows(MONDAY, nightShift, rules);
    expect(w.end).toEqual(at("2026-11-03", "06:00"));
  });
});

describe("attendance date", () => {
  it("puts night-shift events after midnight on the day the shift started", () => {
    expect(attendanceDateFor(at("2026-11-03", "05:55"), nightShift, rules)).toBe(MONDAY);
    expect(attendanceDateFor(at(MONDAY, "21:50"), nightShift, rules)).toBe(MONDAY);
  });

  it("puts day-shift OT that runs past midnight on the previous day", () => {
    expect(attendanceDateFor(at("2026-11-03", "00:30"), dayShift, rules)).toBe(MONDAY);
    expect(attendanceDateFor(at("2026-11-03", "06:50"), dayShift, rules)).toBe("2026-11-03");
  });
});

describe("regular attendance", () => {
  it("counts an on-time day from shift start to shift end", () => {
    const r = day([event("IN", MONDAY, "06:50"), event("OUT", MONDAY, "16:05")]);
    expect(r.effective.status).toBe("PRESENT");
    expect(r.effective.regularMinutes).toBe(540);
    expect(r.effective.flags).not.toContain("LATE");
  });

  it("treats IN within the grace window as on time", () => {
    const r = day([event("IN", MONDAY, "07:14"), event("OUT", MONDAY, "15:50")]);
    expect(r.effective.status).toBe("PRESENT");
    expect(r.effective.regularMinutes).toBe(540);
  });

  it("flags LATE 20 minutes after start and pays from the actual IN, rounded down", () => {
    const r = day([event("IN", MONDAY, "07:20"), event("OUT", MONDAY, "16:00")]);
    expect(r.effective.status).toBe("LATE");
    expect(r.effective.flags).toContain("LATE");
    expect(r.effective.regularMinutes).toBe(510);
  });

  it("can treat any arrival after start as late", () => {
    const strict = { ...rules, lateThreshold: "AFTER_START" as const };
    const r = day([event("IN", MONDAY, "07:05"), event("OUT", MONDAY, "16:00")], { r: strict });
    expect(r.effective.status).toBe("LATE");
  });

  it("uses only the first IN and the last OUT", () => {
    const first = event("IN", MONDAY, "06:55");
    const last = event("OUT", MONDAY, "16:10");
    const r = day([event("IN", MONDAY, "07:05"), first, event("OUT", MONDAY, "15:50"), last, event("OUT", MONDAY, "12:00")]);
    expect(r.firstInEventId).toBe(first.id);
    expect(r.lastOutEventId).toBe(last.id);
  });

  it("ignores exits during the day when a later OUT exists", () => {
    const r = day([event("IN", MONDAY, "06:55"), event("OUT", MONDAY, "11:00"), event("OUT", MONDAY, "16:00")]);
    expect(r.effective.flags).not.toContain("EARLY_OUT");
    expect(r.effective.regularMinutes).toBe(540);
  });

  it("shows MISSING_IN after the IN window closes, then ABSENT after the day ends", () => {
    expect(day([], { now: at(MONDAY, "07:10") }).effective.status).toBe("PENDING");
    expect(day([], { now: at(MONDAY, "07:16") }).effective.status).toBe("MISSING_IN");
    const ended = day([], { now: at(MONDAY, "16:16") }).effective;
    expect(ended.status).toBe("ABSENT");
    expect(ended.flags).toContain("MISSING_IN");
  });

  it("shows MISSING_OUT when no OUT arrives by the end of the OUT window", () => {
    expect(day([event("IN", MONDAY, "06:55")], { now: at(MONDAY, "16:00") }).effective.status).toBe("PENDING");
    expect(day([event("IN", MONDAY, "06:55")], { now: at(MONDAY, "16:16") }).effective.status).toBe("MISSING_OUT");
  });

  it("flags EARLY_OUT and pays to the actual exit", () => {
    const r = day([event("IN", MONDAY, "06:55"), event("OUT", MONDAY, "14:00")]);
    expect(r.effective.flags).toContain("EARLY_OUT");
    expect(r.effective.regularMinutes).toBe(420);
  });

  it("can treat an early exit as MISSING_OUT instead", () => {
    const r = day([event("IN", MONDAY, "06:55"), event("OUT", MONDAY, "14:00")], {
      r: { ...rules, earlyOutPolicy: "MISSING_OUT" },
    });
    expect(r.effective.status).toBe("MISSING_OUT");
  });

  it("deducts the shift break", () => {
    const r = day([event("IN", MONDAY, "06:55"), event("OUT", MONDAY, "16:00")], {
      shift: { ...dayShift, breakMinutes: 60 },
    });
    expect(r.effective.regularMinutes).toBe(480);
  });

  it("flags manual check-ins and mock locations", () => {
    const r = day([
      event("IN", MONDAY, "07:30", { source: "MANUAL", trigger: "NOTIFICATION_TAP", flags: ["MANUAL"] }),
      event("OUT", MONDAY, "16:00", { flags: ["MOCK_LOCATION"], mockLocation: true }),
    ]);
    expect(r.effective.flags).toEqual(expect.arrayContaining(["MANUAL_IN", "MOCK_LOCATION", "LATE"]));
  });

  it("ignores rejected events", () => {
    const r = day([event("IN", MONDAY, "06:55", { status: "REJECTED" })], { now: at(MONDAY, "08:00") });
    expect(r.effective.status).toBe("MISSING_IN");
  });

  it("handles a full night shift across midnight", () => {
    const r = day([event("IN", MONDAY, "21:50"), event("OUT", "2026-11-03", "06:05")], {
      shift: nightShift,
      now: at("2026-11-03", "12:00"),
    });
    expect(r.effective.status).toBe("PRESENT");
    expect(r.effective.regularMinutes).toBe(480);
  });

  it("marks off-day work as OFF with an OFF_DAY_WORK flag and no regular hours", () => {
    const friday = "2026-11-06";
    const r = day([event("IN", friday, "07:00"), event("OUT", friday, "12:00")], { date: friday });
    expect(r.effective.status).toBe("OFF");
    expect(r.effective.flags).toContain("OFF_DAY_WORK");
    expect(r.effective.regularMinutes).toBe(0);
  });
});

describe("corrections", () => {
  const correction = (field: Correction["field"], newValue: Correction["newValue"], createdAt = "2026-11-03T10:00:00Z"): Correction => ({
    id: `x-${field}-${createdAt}`,
    attendanceDayId: `s1_${MONDAY}`,
    staffId: "s1",
    date: MONDAY,
    field,
    oldValue: null,
    newValue,
    reason: "Phone died",
    editedBy: "sup1",
    approvedBy: "sup1",
    createdAt,
  });

  it("keeps computed values and recalculates the effective day", () => {
    const r = day([event("IN", MONDAY, "06:55")], {
      corrections: [correction("lastOut", at(MONDAY, "16:00").toISOString())],
    });
    expect(r.computed.status).toBe("MISSING_OUT");
    expect(r.effective.status).toBe("PRESENT");
    expect(r.effective.regularMinutes).toBe(540);
    expect(r.effective.flags).toContain("CORRECTED");
  });

  it("applies the latest correction per field", () => {
    const r = day([event("IN", MONDAY, "06:55"), event("OUT", MONDAY, "16:00")], {
      corrections: [correction("status", "ABSENT", "2026-11-03T09:00:00Z"), correction("status", "PRESENT", "2026-11-03T11:00:00Z")],
    });
    expect(r.effective.status).toBe("PRESENT");
  });

  it("supports marking a day as leave", () => {
    const r = day([], { corrections: [correction("leave", true)] });
    expect(r.effective.status).toBe("LEAVE");
    expect(r.computed.status).toBe("ABSENT");
  });
});

describe("overtime", () => {
  const base = { date: MONDAY, shift: dayShift, rules, dayType: "WORKDAY" as const, insideGeofence: true };

  it("blocks OT_IN before shift end + 30 minutes with a clear message", () => {
    const r = checkOtIn({ ...base, at: at(MONDAY, "16:20") });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("OT_TOO_EARLY");
      expect(r.message).toContain("16:30");
    }
    expect(checkOtIn({ ...base, at: at(MONDAY, "16:30") }).ok).toBe(true);
  });

  it("blocks OT_IN outside the geofence", () => {
    const r = checkOtIn({ ...base, at: at(MONDAY, "17:00"), insideGeofence: false });
    expect(r.ok).toBe(false);
  });

  it("allows OT_IN at any time on an off-day", () => {
    expect(checkOtIn({ ...base, dayType: "WEEKLY_OFF", at: at("2026-11-06", "08:00") }).ok).toBe(true);
  });

  it("auto-closes 4 hours after OT_IN or at 23:59, whichever is first", () => {
    expect(otAutoCloseAt(at(MONDAY, "16:30"), rules)).toEqual(at(MONDAY, "20:30"));
    expect(otAutoCloseAt(at(MONDAY, "21:00"), rules)).toEqual(at(MONDAY, "23:59"));
  });

  it("rounds OT minutes with the same rule", () => {
    expect(otMinutes(at(MONDAY, "16:30"), at(MONDAY, "18:40"), rules)).toBe(120);
  });

  it("sets the rate type from the day", () => {
    const holidays = new Set(["2026-12-16"]);
    expect(rateTypeFor(MONDAY, dayTypeOf(MONDAY, rules, holidays), rules)).toBe("WEEKDAY");
    expect(rateTypeFor("2026-11-06", dayTypeOf("2026-11-06", rules, holidays), rules)).toBe("FRIDAY");
    expect(rateTypeFor("2026-12-16", dayTypeOf("2026-12-16", rules, holidays), rules)).toBe("HOLIDAY");
  });
});

describe("rounding", () => {
  it("supports down, nearest and up", () => {
    expect(roundMinutes(52, 15, "DOWN")).toBe(45);
    expect(roundMinutes(52, 15, "NEAREST")).toBe(45);
    expect(roundMinutes(53, 15, "NEAREST")).toBe(60);
    expect(roundMinutes(46, 15, "UP")).toBe(60);
    expect(roundMinutes(-5, 15, "UP")).toBe(0);
  });
});
