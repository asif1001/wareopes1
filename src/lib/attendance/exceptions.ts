import { scopeStaff, type Actor } from "./actor";
import { ensureDays } from "./days";
import { deviceIssues, type DeviceIssue } from "./health";
import { listOvertime } from "./overtime";
import { COL, getRules, listStaff, toStaffPublic, type Db } from "./store";
import { localDateOf } from "./time";
import type { AttendanceDay, DayFlag, DeviceHealth, LocalDate, OvertimeRequest, StaffPublic } from "./types";

type StaffRef = Pick<StaffPublic, "id" | "staffCode" | "name" | "contractorId" | "supervisorId">;

export type DayIssue = { staff: StaffRef; day: AttendanceDay };

export type DailyExceptions = {
  date: LocalDate;
  missingIn: DayIssue[];
  missingOut: DayIssue[];
  late: DayIssue[];
  earlyOut: DayIssue[];
  manualIn: DayIssue[];
  locationFlags: DayIssue[];
  overtimePending: (OvertimeRequest & { staff: StaffRef })[];
  overtimeAutoClosed: (OvertimeRequest & { staff: StaffRef })[];
  overtimeInProgress: (OvertimeRequest & { staff: StaffRef })[];
  devices: { staff: StaffRef; issues: DeviceIssue[]; health: Partial<DeviceHealth> | null }[];
  counts: Record<string, number>;
};

const LOCATION_FLAGS: DayFlag[] = ["MOCK_LOCATION", "ROOTED", "OUTSIDE_GEOFENCE", "POOR_ACCURACY", "CLOCK_DRIFT"];

const ref = (s: StaffPublic): StaffRef => ({
  id: s.id,
  staffCode: s.staffCode,
  name: s.name,
  contractorId: s.contractorId,
  supervisorId: s.supervisorId,
});

/** Only problems for the day, never the full list of records. */
export async function getDailyExceptions(db: Db, actor: Actor, date: LocalDate, now: Date): Promise<DailyExceptions> {
  const rules = await getRules(db);
  const staffList = scopeStaff(actor, await listStaff(db)).filter((s) => s.active);
  const staffById = new Map(staffList.map((s) => [s.id, toStaffPublic(s)]));

  const days = await ensureDays(db, staffList, date, now, rules);
  const issue = (day: AttendanceDay): DayIssue | null => {
    const staff = staffById.get(day.staffId);
    return staff ? { staff: ref(staff), day } : null;
  };
  const pick = (test: (d: AttendanceDay) => boolean) =>
    days.filter(test).map(issue).filter((x): x is DayIssue => !!x);

  const allOt = await listOvertime(db, {});
  const withStaff = (ot: OvertimeRequest) => {
    const staff = staffById.get(ot.staffId);
    return staff ? { ...ot, staff: ref(staff) } : null;
  };
  const scopedOt = allOt.map(withStaff).filter((x): x is OvertimeRequest & { staff: StaffRef } => !!x);

  const healthSnap = await db.collection(COL.deviceHealth).get();
  const health = new Map(healthSnap.docs.map((d) => [d.id, d.data() as Partial<DeviceHealth>]));
  const devices = staffList
    .map((s) => {
      const h = health.get(s.id) ?? null;
      return { staff: ref(toStaffPublic(s)), issues: deviceIssues(h, rules, now), health: h };
    })
    .filter((d) => d.issues.length);

  const isToday = date === localDateOf(now, rules.timezone);
  const result: DailyExceptions = {
    date,
    missingIn: pick((d) => d.status === "MISSING_IN" || d.status === "ABSENT"),
    missingOut: pick((d) => d.status === "MISSING_OUT"),
    late: pick((d) => d.flags.includes("LATE")),
    earlyOut: pick((d) => d.flags.includes("EARLY_OUT")),
    manualIn: pick((d) => d.flags.includes("MANUAL_IN")),
    locationFlags: pick((d) => d.flags.some((f) => LOCATION_FLAGS.includes(f))),
    overtimePending: scopedOt.filter((o) => o.status === "PENDING" && !!o.otOut),
    overtimeAutoClosed: scopedOt.filter((o) => o.status === "AUTO_CLOSED"),
    overtimeInProgress: isToday ? scopedOt.filter((o) => !o.otOut) : [],
    devices,
    counts: {},
  };
  result.counts = Object.fromEntries(
    Object.entries(result)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, (v as unknown[]).length]),
  );
  return result;
}

/** Number shown on the nav badge: undecided overtime plus today's day problems. */
export async function pendingCount(db: Db, actor: Actor) {
  const staff = scopeStaff(actor, await listStaff(db));
  const ids = new Set(staff.map((s) => s.id));
  const ot = await listOvertime(db, {});
  return ot.filter((o) => ids.has(o.staffId) && o.otOut && (o.status === "PENDING" || o.status === "AUTO_CLOSED")).length;
}
