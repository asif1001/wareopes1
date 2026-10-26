import { RATE_TYPES, type RateType } from "./config";
import type { AttendanceDay, Contractor, DayFlag, DayStatus, LocalDate, OvertimeRequest, StaffPublic } from "./types";

export type DayException = { date: LocalDate; status: DayStatus; flags: DayFlag[] };

export type StaffMonthRow = {
  staffId: string;
  staffCode: string;
  name: string;
  contractorId: string;
  contractorName: string;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  daysLeave: number;
  daysMissingIn: number;
  daysMissingOut: number;
  daysOffWorked: number;
  regularMinutes: number;
  otMinutes: Record<RateType, number>;
  otMinutesTotal: number;
  exceptions: DayException[];
};

export type ContractorMonthRow = Omit<StaffMonthRow, "staffId" | "staffCode" | "name" | "exceptions"> & {
  staffCount: number;
};

export type MonthReport = {
  month: string;
  staff: StaffMonthRow[];
  contractors: ContractorMonthRow[];
};

const EXCEPTION_STATUSES: DayStatus[] = ["ABSENT", "MISSING_IN", "MISSING_OUT", "LATE"];
const EXCEPTION_FLAGS: DayFlag[] = ["EARLY_OUT", "MANUAL_IN", "MOCK_LOCATION", "ROOTED", "CORRECTED", "OUTSIDE_GEOFENCE"];

const emptyOt = (): Record<RateType, number> =>
  Object.fromEntries(RATE_TYPES.map((r) => [r, 0])) as Record<RateType, number>;

/** Month report: only APPROVED overtime counts. */
export function buildMonthReport(input: {
  month: string;
  staff: StaffPublic[];
  contractors: Contractor[];
  days: AttendanceDay[];
  overtime: OvertimeRequest[];
}): MonthReport {
  const contractorName = new Map(input.contractors.map((c) => [c.id, c.name]));
  const rows = new Map<string, StaffMonthRow>();
  for (const s of input.staff) {
    rows.set(s.id, {
      staffId: s.id,
      staffCode: s.staffCode,
      name: s.name,
      contractorId: s.contractorId,
      contractorName: contractorName.get(s.contractorId) ?? "",
      daysPresent: 0,
      daysLate: 0,
      daysAbsent: 0,
      daysLeave: 0,
      daysMissingIn: 0,
      daysMissingOut: 0,
      daysOffWorked: 0,
      regularMinutes: 0,
      otMinutes: emptyOt(),
      otMinutesTotal: 0,
      exceptions: [],
    });
  }

  for (const day of input.days) {
    const row = rows.get(day.staffId);
    if (!row || day.month !== input.month) continue;
    switch (day.status) {
      case "PRESENT":
        row.daysPresent += 1;
        break;
      case "LATE":
        row.daysPresent += 1;
        row.daysLate += 1;
        break;
      case "ABSENT":
        row.daysAbsent += 1;
        break;
      case "LEAVE":
        row.daysLeave += 1;
        break;
      case "MISSING_IN":
        row.daysMissingIn += 1;
        break;
      case "MISSING_OUT":
        row.daysMissingOut += 1;
        break;
    }
    if (day.flags.includes("OFF_DAY_WORK")) row.daysOffWorked += 1;
    row.regularMinutes += day.regularMinutes;
    if (EXCEPTION_STATUSES.includes(day.status) || day.flags.some((f) => EXCEPTION_FLAGS.includes(f))) {
      row.exceptions.push({ date: day.date, status: day.status, flags: day.flags });
    }
  }

  for (const ot of input.overtime) {
    const row = rows.get(ot.staffId);
    if (!row || ot.status !== "APPROVED" || ot.month !== input.month) continue;
    const minutes = ot.minutes ?? 0;
    row.otMinutes[ot.rateType] += minutes;
    row.otMinutesTotal += minutes;
  }

  const staffRows = Array.from(rows.values()).sort(
    (a, b) => a.contractorName.localeCompare(b.contractorName) || a.staffCode.localeCompare(b.staffCode),
  );
  for (const row of staffRows) row.exceptions.sort((a, b) => a.date.localeCompare(b.date));

  const byContractor = new Map<string, ContractorMonthRow>();
  for (const row of staffRows) {
    let total = byContractor.get(row.contractorId);
    if (!total) {
      total = {
        contractorId: row.contractorId,
        contractorName: row.contractorName,
        staffCount: 0,
        daysPresent: 0,
        daysLate: 0,
        daysAbsent: 0,
        daysLeave: 0,
        daysMissingIn: 0,
        daysMissingOut: 0,
        daysOffWorked: 0,
        regularMinutes: 0,
        otMinutes: emptyOt(),
        otMinutesTotal: 0,
      };
      byContractor.set(row.contractorId, total);
    }
    total.staffCount += 1;
    for (const key of [
      "daysPresent",
      "daysLate",
      "daysAbsent",
      "daysLeave",
      "daysMissingIn",
      "daysMissingOut",
      "daysOffWorked",
      "regularMinutes",
      "otMinutesTotal",
    ] as const) {
      total[key] += row[key];
    }
    for (const rate of RATE_TYPES) total.otMinutes[rate] += row.otMinutes[rate];
  }

  return { month: input.month, staff: staffRows, contractors: Array.from(byContractor.values()) };
}

// ---------------------------------------------------------------------------
// Contractor sheet comparison
// ---------------------------------------------------------------------------

export type ContractorRow = {
  staffCode: string;
  date: LocalDate;
  /** Free text from the sheet: P / PRESENT / A / ABSENT / L / LEAVE / OFF … */
  status?: string | null;
  hours?: number | null;
  otHours?: number | null;
};

export type MismatchKind =
  | "UNKNOWN_STAFF"
  | "NOT_IN_OUR_RECORDS"
  | "NOT_IN_CONTRACTOR_SHEET"
  | "PRESENCE_MISMATCH"
  | "HOURS_MISMATCH"
  | "OT_MISMATCH";

export type Mismatch = {
  kind: MismatchKind;
  staffCode: string;
  date: LocalDate;
  contractor: { status: string | null; hours: number | null; otHours: number | null } | null;
  ours: { status: DayStatus; regularHours: number; approvedOtHours: number } | null;
};

type Presence = "PRESENT" | "ABSENT" | "LEAVE" | "OFF" | "UNKNOWN";

function contractorPresence(row: ContractorRow): Presence {
  const s = (row.status ?? "").trim().toUpperCase();
  if (["P", "PRESENT", "W", "WORKED"].includes(s)) return "PRESENT";
  if (["A", "ABSENT", "AB"].includes(s)) return "ABSENT";
  if (["L", "LEAVE", "SL", "AL", "SICK"].includes(s)) return "LEAVE";
  if (["OFF", "WO", "H", "HOLIDAY"].includes(s)) return "OFF";
  if (typeof row.hours === "number") return row.hours > 0 ? "PRESENT" : "ABSENT";
  return "UNKNOWN";
}

function ourPresence(status: DayStatus): Presence {
  if (status === "PRESENT" || status === "LATE" || status === "MISSING_OUT") return "PRESENT";
  if (status === "LEAVE") return "LEAVE";
  if (status === "OFF" || status === "PENDING") return "OFF";
  return "ABSENT";
}

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** Compare the contractor's attendance sheet with our records, date by date. */
export function compareWithContractor(input: {
  month: string;
  rows: ContractorRow[];
  staff: StaffPublic[];
  days: AttendanceDay[];
  overtime: OvertimeRequest[];
  toleranceMin: number;
}): Mismatch[] {
  const byCode = new Map(input.staff.map((s) => [s.staffCode.toUpperCase(), s]));
  const dayKey = (staffId: string, date: string) => `${staffId}|${date}`;
  const days = new Map(input.days.filter((d) => d.month === input.month).map((d) => [dayKey(d.staffId, d.date), d]));
  const ot = new Map<string, number>();
  for (const o of input.overtime) {
    if (o.status !== "APPROVED" || o.month !== input.month) continue;
    const key = dayKey(o.staffId, o.date);
    ot.set(key, (ot.get(key) ?? 0) + (o.minutes ?? 0));
  }

  const mismatches: Mismatch[] = [];
  const seen = new Set<string>();
  const tolerance = input.toleranceMin / 60;

  for (const row of input.rows) {
    if (!row.date.startsWith(input.month)) continue;
    const code = row.staffCode.trim().toUpperCase();
    const contractor = { status: row.status ?? null, hours: row.hours ?? null, otHours: row.otHours ?? null };
    const staff = byCode.get(code);
    if (!staff) {
      mismatches.push({ kind: "UNKNOWN_STAFF", staffCode: code, date: row.date, contractor, ours: null });
      continue;
    }
    const key = dayKey(staff.id, row.date);
    seen.add(key);
    const day = days.get(key);
    const theirs = contractorPresence(row);
    if (!day) {
      if (theirs === "PRESENT") {
        mismatches.push({ kind: "NOT_IN_OUR_RECORDS", staffCode: code, date: row.date, contractor, ours: null });
      }
      continue;
    }
    const ours = { status: day.status, regularHours: hours(day.regularMinutes), approvedOtHours: hours(ot.get(key) ?? 0) };
    const mine = ourPresence(day.status);
    if (theirs !== "UNKNOWN" && theirs !== mine && !(theirs === "OFF" && mine === "ABSENT" && day.dayType !== "WORKDAY")) {
      mismatches.push({ kind: "PRESENCE_MISMATCH", staffCode: code, date: row.date, contractor, ours });
      continue;
    }
    const threshold = Math.max(tolerance, 0.01);
    if (typeof row.hours === "number" && Math.abs(row.hours - ours.regularHours) >= threshold) {
      mismatches.push({ kind: "HOURS_MISMATCH", staffCode: code, date: row.date, contractor, ours });
    }
    if (typeof row.otHours === "number" && Math.abs(row.otHours - ours.approvedOtHours) >= threshold) {
      mismatches.push({ kind: "OT_MISMATCH", staffCode: code, date: row.date, contractor, ours });
    }
  }

  for (const day of days.values()) {
    const key = dayKey(day.staffId, day.date);
    if (seen.has(key) || ourPresence(day.status) !== "PRESENT") continue;
    const staff = input.staff.find((s) => s.id === day.staffId);
    if (!staff) continue;
    mismatches.push({
      kind: "NOT_IN_CONTRACTOR_SHEET",
      staffCode: staff.staffCode,
      date: day.date,
      contractor: null,
      ours: { status: day.status, regularHours: hours(day.regularMinutes), approvedOtHours: hours(ot.get(key) ?? 0) },
    });
  }

  return mismatches.sort((a, b) => a.staffCode.localeCompare(b.staffCode) || a.date.localeCompare(b.date));
}
