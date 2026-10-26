import type { ContractorRow } from "./report";

/**
 * Turn rows read from a contractor's CSV/Excel sheet into comparison rows.
 * Supports a long layout (one row per staff per day: code, date, status/hours, OT)
 * and a grid layout (one row per staff, one column per day "1"…"31").
 */

const ALIASES = {
  staffCode: ["staffcode", "staffid", "code", "empcode", "employeecode", "empno", "employeeno", "id", "badge", "staffno"],
  date: ["date", "day", "workdate", "attendancedate"],
  status: ["status", "attendance", "pa", "presence", "remark", "remarks"],
  hours: ["hours", "regularhours", "normalhours", "hrs", "workedhours", "workhours", "nh"],
  otHours: ["ot", "othours", "overtime", "overtimehours", "oth", "othrs"],
} as const;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function findColumn(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map(norm);
  for (const alias of aliases) {
    const i = normalized.indexOf(alias);
    if (i >= 0) return headers[i];
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Excel serial, Date, "YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY", "2-Nov-2026" → "YYYY-MM-DD". */
export function toLocalDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{4})$/.exec(s);
  if (m) {
    const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(m[2].toLowerCase());
    if (month >= 0) return `${m[3]}-${pad(month + 1)}-${pad(+m[1])}`;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim();
  const hm = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (hm) return +hm[1] + +hm[2] / 60;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export type SheetParseResult = {
  layout: "long" | "grid" | "unknown";
  rows: ContractorRow[];
  skipped: number;
  columns: Record<string, string | null>;
};

export function parseContractorSheet(records: Record<string, unknown>[], month: string): SheetParseResult {
  const headers = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  const codeCol = findColumn(headers, ALIASES.staffCode);
  const dateCol = findColumn(headers, ALIASES.date);
  const statusCol = findColumn(headers, ALIASES.status);
  const hoursCol = findColumn(headers, ALIASES.hours);
  const otCol = findColumn(headers, ALIASES.otHours);
  const columns = { staffCode: codeCol, date: dateCol, status: statusCol, hours: hoursCol, otHours: otCol };
  if (!codeCol) return { layout: "unknown", rows: [], skipped: records.length, columns };

  const rows: ContractorRow[] = [];
  let skipped = 0;

  if (dateCol) {
    for (const r of records) {
      const staffCode = String(r[codeCol] ?? "").trim();
      const date = toLocalDate(r[dateCol]);
      if (!staffCode || !date) {
        skipped += 1;
        continue;
      }
      const hoursValue = hoursCol ? toNumber(r[hoursCol]) : null;
      rows.push({
        staffCode,
        date,
        status: statusCol ? String(r[statusCol] ?? "").trim() || null : null,
        hours: hoursValue,
        otHours: otCol ? toNumber(r[otCol]) : null,
      });
    }
    return { layout: "long", rows, skipped, columns };
  }

  const dayColumns = headers.filter((h) => /^\d{1,2}$/.test(h.trim()) && +h >= 1 && +h <= 31);
  if (!dayColumns.length) return { layout: "unknown", rows: [], skipped: records.length, columns };
  for (const r of records) {
    const staffCode = String(r[codeCol] ?? "").trim();
    if (!staffCode) {
      skipped += 1;
      continue;
    }
    for (const col of dayColumns) {
      const raw = r[col];
      if (raw == null || String(raw).trim() === "") continue;
      const date = `${month}-${pad(+col)}`;
      const n = toNumber(raw);
      rows.push(n != null ? { staffCode, date, hours: n, status: n > 0 ? "P" : "A" } : { staffCode, date, status: String(raw).trim() });
    }
  }
  return { layout: "grid", rows, skipped, columns };
}
