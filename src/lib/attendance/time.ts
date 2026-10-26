import type { IsoInstant, LocalDate } from "./types";

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Minutes the zone is ahead of UTC at the given instant. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

function parseDate(date: LocalDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Invalid date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function parseTimeOfDay(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid time: ${time}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Convert a local wall-clock date + "HH:mm" in `timeZone` to a UTC instant. */
export function zonedToUtc(date: LocalDate, time: string, timeZone: string): Date {
  const { year, month, day } = parseDate(date);
  const { hour, minute } = parseTimeOfDay(time);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = zoneOffsetMinutes(new Date(guess), timeZone);
  let result = guess - firstOffset * 60000;
  const secondOffset = zoneOffsetMinutes(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = guess - secondOffset * 60000;
  return new Date(result);
}

export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const w = wallClock(instant, timeZone);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

export function localTimeOf(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (timezone-independent). */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function monthOf(date: LocalDate): string {
  return date.slice(0, 7);
}

export function daysInMonth(month: string): LocalDate[] {
  const [year, mon] = month.split("-").map(Number);
  if (!year || !mon) throw new Error(`Invalid month: ${month}`);
  const count = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

export function nextMonth(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, mon, 1));
  return d.toISOString().slice(0, 7);
}

export function isValidLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function minutesBetween(from: Date | IsoInstant, to: Date | IsoInstant): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60000;
}

export function addMinutes(instant: Date | IsoInstant, minutes: number): Date {
  return new Date(new Date(instant).getTime() + minutes * 60000);
}

export function iso(instant: Date): IsoInstant {
  return instant.toISOString();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
