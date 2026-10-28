"use client";

const TZ = "Asia/Bahrain";

export function fmtTime(iso: string | null | undefined, timeZone = TZ) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function fmtDateTime(iso: string | null | undefined, timeZone = TZ) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function fmtMinutes(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

export function hours(minutes: number | null | undefined) {
  return Math.round(((minutes ?? 0) / 60) * 100) / 100;
}

export function todayLocal(timeZone = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function thisMonth(timeZone = TZ) {
  return todayLocal(timeZone).slice(0, 7);
}

/** "YYYY-MM-DD" + "HH:mm" in Bahrain → ISO instant (Bahrain has no DST, UTC+3). */
export function localToIso(date: string, time: string, offset = "+03:00") {
  return new Date(`${date}T${time}:00${offset}`).toISOString();
}

export function mapsLink(lat: number | null | undefined, lng: number | null | undefined) {
  return lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null;
}

export const FLAG_LABELS: Record<string, string> = {
  LATE: "Late",
  EARLY_OUT: "Left early",
  MISSING_IN: "Missing IN",
  MISSING_OUT: "Missing OUT",
  MANUAL_IN: "Manual check-in",
  MOCK_LOCATION: "Fake GPS",
  ROOTED: "Rooted phone",
  POOR_ACCURACY: "Poor GPS",
  OUTSIDE_GEOFENCE: "Outside area",
  CLOCK_DRIFT: "Phone clock wrong",
  OFF_DAY_WORK: "Worked on off-day",
  CORRECTED: "Corrected",
  NO_LOCATION: "No location",
  FUTURE_TIME: "Future time",
  MANUAL: "Manual",
  LOCKED_MONTH: "Locked month",
};

export const DEVICE_ISSUE_LABELS: Record<string, string> = {
  NO_DATA: "App never reported",
  NO_SYNC: "No sync recently",
  LOCATION_NOT_ALWAYS: "Location not 'All the time'",
  GPS_OFF: "GPS off",
  BATTERY_OPTIMISED: "Battery optimisation on",
  NOTIFICATIONS_OFF: "Notifications off",
  MOCK_APP: "Fake GPS app",
  ROOTED: "Rooted phone",
  APP_OUTDATED: "App outdated",
  NO_ACTIVE_SITE: "No active site",
  FAR_FROM_SITE: "Last tap far from site",
};

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
