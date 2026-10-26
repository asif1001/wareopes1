import type { Query } from "firebase-admin/firestore";
import { z } from "zod";
import { scopeStaff, type Actor } from "./actor";
import { recomputeDay } from "./days";
import { badRequest } from "./errors";
import { getMonthLockState } from "./locks";
import { buildMonthReport, compareWithContractor } from "./report";
import { COL, getRules, listShifts, listStaff, toStaffPublic, type Db } from "./store";
import { addDays, daysInMonth, isValidLocalDate, isValidMonth, localDateOf } from "./time";
import type { AttendanceDay, Contractor, OvertimeRequest, Staff } from "./types";

/** Create day records that the scheduler has not written yet (e.g. absences). */
async function fillMissingDays(db: Db, staffList: Staff[], month: string, existing: AttendanceDay[], now: Date) {
  const rules = await getRules(db);
  if ((await getMonthLockState(db, month, rules, now)).locked) return [];
  const shifts = new Map((await listShifts(db)).map((s) => [s.id, s]));
  const yesterday = addDays(localDateOf(now, rules.timezone), -1);
  const have = new Set(existing.map((d) => `${d.staffId}|${d.date}`));
  const created: AttendanceDay[] = [];
  for (const staff of staffList) {
    const shift = shifts.get(staff.shiftId);
    if (!staff.active || !shift) continue;
    const since = staff.createdAt.slice(0, 10);
    for (const date of daysInMonth(month)) {
      if (date > yesterday || date < since || have.has(`${staff.id}|${date}`)) continue;
      const day = await recomputeDay(db, staff, date, now, { rules, shift });
      if (day) created.push(day);
    }
  }
  return created;
}

async function loadMonth(db: Db, actor: Actor, month: string, now: Date, contractorId?: string) {
  if (!isValidMonth(month)) throw badRequest("Month must be YYYY-MM");
  let staff = scopeStaff(actor, await listStaff(db));
  if (contractorId) staff = staff.filter((s) => s.contractorId === contractorId);
  const ids = new Set(staff.map((s) => s.id));

  const [daySnap, otSnap, contractorSnap] = await Promise.all([
    db.collection(COL.days).where("month", "==", month).get(),
    db.collection(COL.overtime).where("month", "==", month).get(),
    db.collection(COL.contractors).get(),
  ]);
  let days = daySnap.docs.map((d) => d.data() as AttendanceDay).filter((d) => ids.has(d.staffId));
  days = [...days, ...(await fillMissingDays(db, staff, month, days, now))];
  const overtime = otSnap.docs
    .map((d) => ({ ...(d.data() as OvertimeRequest), id: d.id }))
    .filter((o) => ids.has(o.staffId));
  const contractors = contractorSnap.docs.map((d) => ({ ...(d.data() as Contractor), id: d.id }));
  return { staff: staff.map(toStaffPublic), days, overtime, contractors };
}

export async function getMonthReport(db: Db, actor: Actor, month: string, now: Date, contractorId?: string) {
  const data = await loadMonth(db, actor, month, now, contractorId);
  const rules = await getRules(db);
  const lock = await getMonthLockState(db, month, rules, now);
  return { ...buildMonthReport({ month, ...data }), lock };
}

const compareSchema = z.object({
  month: z.string().refine(isValidMonth, "Month must be YYYY-MM"),
  contractorId: z.string().optional(),
  rows: z
    .array(
      z.object({
        staffCode: z.string().trim().min(1),
        date: z.string().refine(isValidLocalDate, "Invalid date"),
        status: z.string().nullable().optional(),
        hours: z.number().min(0).max(24).nullable().optional(),
        otHours: z.number().min(0).max(24).nullable().optional(),
      }),
    )
    .max(20000),
});

export async function compareContractorSheet(db: Db, actor: Actor, body: unknown, now: Date) {
  const parsed = compareSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid comparison data");
  const { month, contractorId, rows } = parsed.data;
  const data = await loadMonth(db, actor, month, now, contractorId);
  const rules = await getRules(db);
  const mismatches = compareWithContractor({ month, rows, ...data, toleranceMin: rules.compareToleranceMin });
  return { month, rowsChecked: rows.length, mismatches };
}

export async function listDays(db: Db, actor: Actor, filter: { date?: string; staffId?: string; month?: string }) {
  const staff = scopeStaff(actor, await listStaff(db));
  const ids = new Set(staff.map((s) => s.id));
  let query: Query = db.collection(COL.days);
  if (filter.date) query = query.where("date", "==", filter.date);
  if (filter.month) query = query.where("month", "==", filter.month);
  if (filter.staffId) query = query.where("staffId", "==", filter.staffId);
  const snap = await query.get();
  return snap.docs
    .map((d) => d.data() as AttendanceDay)
    .filter((d) => ids.has(d.staffId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.staffId.localeCompare(b.staffId));
}
