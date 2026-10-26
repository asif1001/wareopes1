import { z } from "zod";

/**
 * Attendance rules. These defaults seed `attSettings/rules`; supervisors and
 * admins edit the live values on the Attendance → Settings page. Nothing in
 * the rules engine reads these constants directly — always pass the merged
 * settings from `getRules()`.
 */

export const RATE_TYPES = ["WEEKDAY", "FRIDAY", "HOLIDAY"] as const;
export type RateType = (typeof RATE_TYPES)[number];

export const ROUNDING_MODES = ["DOWN", "NEAREST", "UP"] as const;
export type RoundingMode = (typeof ROUNDING_MODES)[number];

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const rulesSchema = z.object({
  timezone: z.string().min(1),
  /** 0 = Sunday … 6 = Saturday */
  weeklyOffDays: z.array(z.number().int().min(0).max(6)),
  /** Rate applied to OT on each weekly off-day; days not listed use WEEKDAY. */
  offDayRateTypes: z.record(z.string(), z.enum(RATE_TYPES)),
  holidayRateType: z.enum(RATE_TYPES),
  workdayRateType: z.enum(RATE_TYPES),
  /** Work on a weekly off-day or holiday counts entirely as overtime. */
  offDayWorkIsOvertime: z.boolean(),

  /** Lateness starts after start + graceAfter ("AFTER_GRACE") or after start ("AFTER_START"). */
  lateThreshold: z.enum(["AFTER_GRACE", "AFTER_START"]),
  /** On-time IN is paid from shift start; otherwise from the actual IN. */
  payFromShiftStartWhenOnTime: z.boolean(),
  /** OUT at or after the OUT window opens is paid to shift end. */
  payToShiftEndWhenInWindow: z.boolean(),
  /** Leaving before the OUT window: flag EARLY_OUT using the last exit, or treat as MISSING_OUT. */
  earlyOutPolicy: z.enum(["FLAG_EARLY_OUT", "MISSING_OUT"]),

  roundingStepMin: z.number().int().min(1).max(60),
  roundingMode: z.enum(ROUNDING_MODES),

  otStartAfterShiftEndMin: z.number().int().min(0).max(600),
  otAutoCloseAfterMin: z.number().int().min(15).max(24 * 60),
  /** Local wall-clock cut-off for an open OT; null disables it. */
  otAutoCloseAtLocal: timeOfDay.nullable(),
  otReminderAfterHours: z.number().int().min(1).max(240),
  otEscalateAfterHours: z.number().int().min(1).max(480),

  /** Day of next month on which a month locks automatically. */
  monthLockDay: z.number().int().min(1).max(28),
  selfieRetentionDays: z.number().int().min(1).max(3650),
  clockDriftToleranceMin: z.number().int().min(0).max(120),
  /** Readings with accuracy worse than this are flagged, never rejected. */
  poorAccuracyM: z.number().int().min(5).max(5000),
  /** A device that has not synced for this long shows as an exception. */
  noSyncAlertHours: z.number().int().min(1).max(168),

  /** Contractor-import comparison: hour differences below this are ignored. */
  compareToleranceMin: z.number().int().min(0).max(240),

  /** WareOps user ids with read-only access to every staff member's records and reports. Admin-only setting. */
  reportViewerIds: z.array(z.string().min(1)).max(200),

  latestAppVersion: z.string(),
  minAppVersion: z.string(),
  apkUrl: z.string(),
  apkSha256: z.string(),
});

export type AttendanceRules = z.infer<typeof rulesSchema>;

export const DEFAULT_RULES: AttendanceRules = {
  timezone: "Asia/Bahrain",
  weeklyOffDays: [5],
  offDayRateTypes: { "5": "FRIDAY", "6": "FRIDAY" },
  holidayRateType: "HOLIDAY",
  workdayRateType: "WEEKDAY",
  offDayWorkIsOvertime: true,

  lateThreshold: "AFTER_GRACE",
  payFromShiftStartWhenOnTime: true,
  payToShiftEndWhenInWindow: true,
  earlyOutPolicy: "FLAG_EARLY_OUT",

  roundingStepMin: 15,
  roundingMode: "DOWN",

  otStartAfterShiftEndMin: 30,
  otAutoCloseAfterMin: 240,
  otAutoCloseAtLocal: "23:59",
  otReminderAfterHours: 24,
  otEscalateAfterHours: 48,

  monthLockDay: 5,
  selfieRetentionDays: 90,
  clockDriftToleranceMin: 5,
  poorAccuracyM: 100,
  noSyncAlertHours: 24,

  compareToleranceMin: 15,

  reportViewerIds: [],

  latestAppVersion: "1.0.0",
  minAppVersion: "1.0.0",
  apkUrl: "",
  apkSha256: "",
};

/** Merge stored values over defaults so new rule keys get sensible values. */
export function mergeRules(stored: unknown): AttendanceRules {
  const merged = {
    ...DEFAULT_RULES,
    ...(stored && typeof stored === "object" ? stored : {}),
  };
  const parsed = rulesSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_RULES;
}

/** Shift defaults (per-shift values override these). */
export const DEFAULT_SHIFT_GRACE_MIN = 15;
export const DEFAULT_GEOFENCE_RADIUS_M = 200;

/** Mobile auth (not user-editable). */
export const MOBILE_AUTH = {
  accessTokenTtlSec: 60 * 60,
  refreshTokenTtlSec: 60 * 60 * 24 * 30,
  maxPinFailures: 5,
  pinLockoutMin: 15,
  pinMinLength: 4,
  pinMaxLength: 8,
} as const;

export const MAX_EVENTS_PER_SYNC = 100;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const CONSENT_VERSION = "2026-10-v1";
