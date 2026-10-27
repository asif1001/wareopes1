"use client";

import type { MonthReport } from "@/lib/attendance/report";
import type { AttendanceDay, OvertimeRequest } from "@/lib/attendance/types";
import { fmtTime, hours } from "./format";

type StaffInfo = { staffCode: string; name: string; contractor: string };

/** Month-end workbook for reconciliation against the contractor's invoice. */
export async function exportMonthWorkbook(input: {
  report: MonthReport & { lock?: { locked: boolean } };
  days: AttendanceDay[];
  overtime: OvertimeRequest[];
  staff: (id: string) => StaffInfo | undefined;
  userName: (id: string | null) => string;
  generatedBy: string;
}) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const { report } = input;

  const summary = [
    [`Attendance ${report.month}`, "", `Generated ${new Date().toLocaleString("en-GB")} by ${input.generatedBy}`],
    [report.lock?.locked ? "Month is LOCKED" : "Month is open — figures may still change"],
    [],
    [
      "Contract company",
      "Staff code",
      "CPR",
      "Name",
      "Days present",
      "of which late",
      "Absent",
      "Leave",
      "Missing IN",
      "Missing OUT",
      "Off-days worked",
      "Regular hours",
      "OT weekday h",
      "OT Friday h",
      "OT holiday h",
      "OT total h",
    ],
    ...report.staff.map((r) => [
      r.contractorName,
      r.staffCode,
      r.cprNo ?? "",
      r.name,
      r.daysPresent,
      r.daysLate,
      r.daysAbsent,
      r.daysLeave,
      r.daysMissingIn,
      r.daysMissingOut,
      r.daysOffWorked,
      hours(r.regularMinutes),
      hours(r.otMinutes.WEEKDAY),
      hours(r.otMinutes.FRIDAY),
      hours(r.otMinutes.HOLIDAY),
      hours(r.otMinutesTotal),
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Per staff");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Contractor", "Staff", "Days present", "Late", "Absent", "Leave", "Regular hours", "OT weekday h", "OT Friday h", "OT holiday h", "OT total h"],
      ...report.contractors.map((c) => [
        c.contractorName,
        c.staffCount,
        c.daysPresent,
        c.daysLate,
        c.daysAbsent,
        c.daysLeave,
        hours(c.regularMinutes),
        hours(c.otMinutes.WEEKDAY),
        hours(c.otMinutes.FRIDAY),
        hours(c.otMinutes.HOLIDAY),
        hours(c.otMinutesTotal),
      ]),
    ]),
    "Per contractor",
  );

  const sortedDays = [...input.days].sort((a, b) => a.date.localeCompare(b.date));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Staff code", "Name", "Contractor", "Date", "Day type", "Status", "IN", "OUT", "Regular hours", "Flags", "Corrected"],
      ...sortedDays.map((d) => {
        const s = input.staff(d.staffId);
        return [
          s?.staffCode ?? d.staffId,
          s?.name ?? "",
          s?.contractor ?? "",
          d.date,
          d.dayType,
          d.status,
          d.firstIn ? fmtTime(d.firstIn) : "",
          d.lastOut ? fmtTime(d.lastOut) : "",
          hours(d.regularMinutes),
          d.flags.join(", "),
          d.flags.includes("CORRECTED") ? "yes" : "",
        ];
      }),
    ]),
    "Daily",
  );

  const approved = input.overtime.filter((o) => o.status === "APPROVED").sort((a, b) => a.otIn.localeCompare(b.otIn));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Staff code", "Name", "Date", "Rate", "OT In", "OT Out", "Claimed h", "Approved h", "Approved by", "Note", "Auto-closed"],
      ...approved.map((o) => {
        const s = input.staff(o.staffId);
        return [
          s?.staffCode ?? o.staffId,
          s?.name ?? "",
          o.date,
          o.rateType,
          fmtTime(o.otIn),
          fmtTime(o.otOut),
          hours(o.claimedMinutes),
          hours(o.minutes),
          input.userName(o.approverId),
          o.decisionNote ?? "",
          o.autoClosed ? "yes" : "",
        ];
      }),
    ]),
    "Approved overtime",
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Staff code", "Name", "Date", "Status", "Flags"],
      ...report.staff.flatMap((r) => r.exceptions.map((e) => [r.staffCode, r.name, e.date, e.status, e.flags.join(", ")])),
    ]),
    "Exceptions",
  );

  XLSX.writeFile(wb, `attendance-${report.month}.xlsx`);
}

/** Read the first sheet of an uploaded CSV/Excel file into plain records. */
export async function readSheet(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}
