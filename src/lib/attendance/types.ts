import type { RateType } from "./config";

/** Instants are ISO-8601 UTC strings; calendar dates are "YYYY-MM-DD" in the rules timezone. */
export type IsoInstant = string;
export type LocalDate = string;

export type Contractor = {
  id: string;
  name: string;
  active: boolean;
  createdAt: IsoInstant;
};

export type Shift = {
  id: string;
  name: string;
  /** "HH:mm" local */
  startTime: string;
  endTime: string;
  /** Derived when end <= start; may also be set explicitly. */
  crossesMidnight: boolean;
  graceBeforeMin: number;
  graceAfterMin: number;
  breakMinutes: number;
  active: boolean;
};

export type Geofence = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  active: boolean;
};

export type HolidayType = "PUBLIC" | "COMPANY";

export type Holiday = {
  /** doc id = date */
  date: LocalDate;
  name: string;
  type: HolidayType;
};

export type Staff = {
  id: string;
  staffCode: string;
  name: string;
  contractorId: string;
  /** Supervisor 1 and Supervisor 2 (WareOps `Users` doc ids): the only non-admins who can view, edit and approve this staff member. */
  supervisorId: string;
  supervisor2Id: string | null;
  shiftId: string;
  geofenceIds: string[];
  deviceId: string | null;
  deviceBoundAt: IsoInstant | null;
  active: boolean;
  pinHash: string | null;
  pinFailures: number;
  pinLockedUntil: IsoInstant | null;
  tokenVersion: number;
  consentAt: IsoInstant | null;
  consentVersion: string | null;
  createdAt: IsoInstant;
  updatedAt: IsoInstant;
};

/** Staff as returned to supervisors (no secrets). */
export type StaffPublic = Omit<Staff, "pinHash" | "pinFailures" | "pinLockedUntil" | "tokenVersion">;

export const EVENT_TYPES = ["IN", "OUT", "OT_IN", "OT_OUT"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_SOURCES = ["AUTO", "MANUAL", "CORRECTION"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

export const EVENT_TRIGGERS = [
  "GEOFENCE_ENTER",
  "GEOFENCE_EXIT",
  "GEOFENCE_DWELL",
  "SCHEDULED",
  "NOTIFICATION_TAP",
  "USER_TAP",
] as const;
export type EventTrigger = (typeof EVENT_TRIGGERS)[number];

export type EventStatus = "ACCEPTED" | "REJECTED";

export type AttendanceEvent = {
  id: string;
  clientEventId: string;
  staffId: string;
  deviceId: string;
  type: EventType;
  source: EventSource;
  trigger: EventTrigger;
  /** Time reported by the phone */
  deviceTime: IsoInstant;
  /** Time the server received the batch */
  receivedAt: IsoInstant;
  /** Server-minus-device clock difference measured at sync, in seconds */
  clockDriftSec: number;
  /** deviceTime corrected by the measured drift; used by all rules */
  effectiveTime: IsoInstant;
  attendanceDate: LocalDate;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  geofenceId: string | null;
  insideGeofence: boolean;
  mockLocation: boolean;
  rooted: boolean;
  photoRef: string | null;
  flags: EventFlag[];
  status: EventStatus;
  rejectReason: string | null;
};

export type EventFlag =
  | "MOCK_LOCATION"
  | "ROOTED"
  | "POOR_ACCURACY"
  | "OUTSIDE_GEOFENCE"
  | "NO_LOCATION"
  | "CLOCK_DRIFT"
  | "FUTURE_TIME"
  | "MANUAL"
  | "LOCKED_MONTH";

export const DAY_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "MISSING_IN",
  "MISSING_OUT",
  "LEAVE",
  "OFF",
  "PENDING",
] as const;
export type DayStatus = (typeof DAY_STATUSES)[number];

export type DayFlag =
  | "LATE"
  | "EARLY_OUT"
  | "MISSING_IN"
  | "MISSING_OUT"
  | "MANUAL_IN"
  | "MOCK_LOCATION"
  | "ROOTED"
  | "POOR_ACCURACY"
  | "OUTSIDE_GEOFENCE"
  | "CLOCK_DRIFT"
  | "OFF_DAY_WORK"
  | "CORRECTED";

export type DayType = "WORKDAY" | "WEEKLY_OFF" | "HOLIDAY";

export type DayValues = {
  firstIn: IsoInstant | null;
  lastOut: IsoInstant | null;
  regularMinutes: number;
  status: DayStatus;
  flags: DayFlag[];
};

export type AttendanceDay = DayValues & {
  /** doc id = `${staffId}_${date}` */
  id: string;
  staffId: string;
  contractorId: string;
  supervisorId: string;
  date: LocalDate;
  month: string;
  dayType: DayType;
  shiftId: string;
  firstInEventId: string | null;
  lastOutEventId: string | null;
  /** Values computed from events only, before corrections */
  computed: DayValues;
  leave: boolean;
  staffComments: { text: string; at: IsoInstant }[];
  updatedAt: IsoInstant;
};

export type OvertimeStatus = "PENDING" | "APPROVED" | "REJECTED" | "AUTO_CLOSED";

export type OvertimeRequest = {
  id: string;
  staffId: string;
  contractorId: string;
  supervisorId: string;
  supervisor2Id: string | null;
  date: LocalDate;
  month: string;
  dayType: DayType;
  rateType: RateType;
  otIn: IsoInstant;
  otOut: IsoInstant | null;
  otInEventId: string;
  otOutEventId: string | null;
  inPhotoRef: string | null;
  outPhotoRef: string | null;
  /** Rounded minutes as claimed by events */
  claimedMinutes: number | null;
  /** Minutes that count once approved (may be edited by the approver) */
  minutes: number | null;
  reason: string;
  status: OvertimeStatus;
  autoClosed: boolean;
  flags: EventFlag[];
  approverId: string | null;
  decidedAt: IsoInstant | null;
  decisionNote: string | null;
  reminderAt: IsoInstant | null;
  escalatedAt: IsoInstant | null;
  createdAt: IsoInstant;
};

export const CORRECTION_FIELDS = ["firstIn", "lastOut", "status", "leave"] as const;
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

export type Correction = {
  id: string;
  attendanceDayId: string;
  staffId: string;
  date: LocalDate;
  field: CorrectionField;
  oldValue: string | boolean | null;
  newValue: string | boolean | null;
  reason: string;
  editedBy: string;
  approvedBy: string | null;
  createdAt: IsoInstant;
};

export type MonthLock = {
  /** doc id = month "YYYY-MM" */
  month: string;
  locked: boolean;
  lockedAt: IsoInstant | null;
  lockedBy: string | null;
  unlockedAt: IsoInstant | null;
  unlockedBy: string | null;
  unlockReason: string | null;
};

export type AuditEntry = {
  id: string;
  who: string;
  what: string;
  entity: string;
  entityId: string;
  when: IsoInstant;
  before: unknown;
  after: unknown;
};

export type LocationPermission = "ALWAYS" | "WHILE_IN_USE" | "DENIED";

export type DeviceHealth = {
  staffId: string;
  deviceId: string;
  lastSync: IsoInstant;
  locationPermission: LocationPermission;
  gpsEnabled: boolean;
  /** true = battery optimisation is ON for the app (bad) */
  batteryOptimised: boolean;
  notificationsEnabled: boolean;
  mockLocationDetected: boolean;
  rooted: boolean;
  appVersion: string;
  osVersion: string;
  manufacturer: string;
  model: string;
  reportedAt: IsoInstant;
};
