import type { Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { MAX_EVENTS_PER_SYNC, type AttendanceRules } from "./config";
import { recomputeDay } from "./days";
import { badRequest } from "./errors";
import { verifyGateCode } from "./gate";
import { haversineMeters, matchGeofence } from "./geo";
import { getMonthLockState } from "./locks";
import { attendanceDateFor, checkOtIn, dayTypeOf, otAutoCloseAt, otMinutes, rateTypeFor, shiftWindows } from "./rules";
import { COL, eventId, getGeofencesFor, getHolidaySet, getRules, getShift, type Db } from "./store";
import { monthOf } from "./time";
import {
  EVENT_TRIGGERS,
  EVENT_TYPES,
  type AttendanceEvent,
  type EventFlag,
  SYSTEM_APPROVER,
  type Geofence,
  type LocalDate,
  type OvertimeRequest,
  type Shift,
  type Staff,
} from "./types";

const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

export const incomingEventSchema = z.object({
  clientEventId: z.string().regex(idPattern),
  type: z.enum(EVENT_TYPES),
  source: z.enum(["AUTO", "MANUAL", "QR"]),
  trigger: z.enum(EVENT_TRIGGERS),
  deviceTime: z.string().datetime({ offset: true }),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  accuracyM: z.number().min(0).max(100000).nullable(),
  mockLocation: z.boolean(),
  rooted: z.boolean().default(false),
  photoRef: z.string().regex(idPattern).nullable().default(null),
  reason: z.string().trim().max(500).optional(),
  /** Code scanned from the site gate screen (or its URL). */
  gateCode: z.string().trim().max(400).optional(),
});

/** Events the gate station creates for a scanned staff QR (never accepted from phones). */
const stationEventSchema = incomingEventSchema.extend({ source: z.literal("STATION"), trigger: z.literal("STATION_SCAN") });

export type IncomingEvent = z.infer<typeof incomingEventSchema> | z.infer<typeof stationEventSchema>;

export const syncBatchSchema = z.object({
  /** Phone clock when the batch was sent; used to measure clock drift */
  sentAt: z.string().datetime({ offset: true }),
  events: z.array(z.unknown()).min(1).max(MAX_EVENTS_PER_SYNC),
});

export type EventResult = {
  clientEventId: string | null;
  status: "ACCEPTED" | "DUPLICATE" | "REJECTED";
  code?: string;
  message?: string;
  attendanceDate?: LocalDate;
};

const FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

type Context = {
  staff: Staff;
  rules: AttendanceRules;
  shift: Shift;
  geofences: Geofence[];
  driftSec: number;
  now: Date;
  /** Set only for records made by a gate station (staff QR scanned at this site). */
  stationSiteId: string | null;
};

type Prepared = {
  input: IncomingEvent;
  event: AttendanceEvent;
  /** Refused before storing (kept as a REJECTED record for the audit trail). */
  refusal: { code: string; message: string } | null;
};

const GATE_QR_REFUSALS: Record<string, string> = {
  EXPIRED: "The site QR code had expired. Scan the live code on the gate screen again.",
  WRONG_SITE: "This QR code is for a site you are not assigned to.",
  SIGNATURE: "This is not a valid site QR code.",
  FORMAT: "This is not a valid site QR code.",
};

function prepare(input: IncomingEvent, ctx: Context): Prepared {
  const { staff, rules, shift, geofences, driftSec, now } = ctx;
  const flags = new Set<EventFlag>();
  let refusal: Prepared["refusal"] = null;
  let effective = new Date(new Date(input.deviceTime).getTime() + driftSec * 1000);
  if (Math.abs(driftSec) > rules.clockDriftToleranceMin * 60) flags.add("CLOCK_DRIFT");
  if (effective.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    flags.add("FUTURE_TIME");
    effective = now;
  }

  let match = matchGeofence(input.lat, input.lng, input.accuracyM, geofences);
  let source: AttendanceEvent["source"] = input.source;
  let qrVerified = false;
  if (input.source === "STATION" && ctx.stationSiteId) {
    qrVerified = true;
    match = { geofenceId: ctx.stationSiteId, distanceM: null, inside: true };
  } else if (input.source === "QR" || input.gateCode) {
    // Checked against the corrected scan time, so a code scanned offline is still valid when it arrives later.
    const check = input.gateCode ? verifyGateCode(input.gateCode, effective, geofences) : null;
    if (check?.ok) {
      qrVerified = true;
      source = "QR";
      const site = geofences.find((g) => g.id === check.siteId)!;
      const distanceM = input.lat != null && input.lng != null ? Math.round(haversineMeters(input.lat, input.lng, site.lat, site.lng)) : null;
      match = { geofenceId: site.id, distanceM, inside: true };
      // A reliable fix far from the gate suggests the code was relayed (photo sent to someone elsewhere).
      if (distanceM != null && (input.accuracyM ?? 0) <= QR_RELAY_MAX_ACCURACY_M && distanceM > Math.max(QR_RELAY_DISTANCE_M, site.radiusM * 3)) {
        flags.add("OUTSIDE_GEOFENCE");
      }
    } else {
      flags.add("QR_INVALID");
      if (source === "QR") source = "MANUAL";
      refusal = { code: "QR_INVALID", message: GATE_QR_REFUSALS[check?.reason ?? "FORMAT"] };
    }
  }
  if (!qrVerified) {
    if (input.lat == null || input.lng == null) flags.add("NO_LOCATION");
    else if (!match.inside) flags.add("OUTSIDE_GEOFENCE");
    if (input.accuracyM != null && input.accuracyM > rules.poorAccuracyM) flags.add("POOR_ACCURACY");
  }
  if (input.mockLocation) flags.add("MOCK_LOCATION");
  if (input.rooted) flags.add("ROOTED");
  if (source === "MANUAL") flags.add("MANUAL");

  // Check In / Check Out by GPS only works inside the site circle; otherwise scan a QR.
  if (!refusal && source === "MANUAL" && (input.type === "IN" || input.type === "OUT") && !match.inside) {
    const site = geofences.find((g) => g.id === match.geofenceId);
    refusal =
      match.distanceM == null || !site
        ? { code: "NO_LOCATION", message: "Your location is not available. Turn on GPS, or scan the site QR / show your QR at the gate." }
        : {
            code: "OUTSIDE_GEOFENCE",
            message: `You are ${match.distanceM} m from ${site.name}, outside the site circle (${site.radiusM} m). Scan the site QR or show your QR at the gate.`,
          };
  }

  const id = eventId(staff.id, input.clientEventId);
  return {
    refusal,
    input,
    event: {
      id,
      clientEventId: input.clientEventId,
      staffId: staff.id,
      deviceId: staff.deviceId ?? "",
      type: input.type,
      source,
      trigger: input.trigger,
      deviceTime: new Date(input.deviceTime).toISOString(),
      receivedAt: now.toISOString(),
      clockDriftSec: Math.round(driftSec),
      effectiveTime: effective.toISOString(),
      attendanceDate: attendanceDateFor(effective, shift, rules),
      lat: input.lat,
      lng: input.lng,
      accuracyM: input.accuracyM,
      distanceM: match.distanceM,
      geofenceId: match.geofenceId,
      insideGeofence: match.inside,
      mockLocation: input.mockLocation,
      rooted: input.rooted,
      photoRef: input.photoRef,
      flags: Array.from(flags).sort(),
      status: "ACCEPTED",
      rejectReason: null,
    },
  };
}

/**
 * Store a batch of events from the phone. Each event is written once
 * (doc id = staff + clientEventId), so retries after being offline never
 * duplicate records.
 */
export async function ingestEvents(
  db: Db,
  staff: Staff,
  body: unknown,
  now: Date,
  options: { stationSiteId?: string } = {},
): Promise<EventResult[]> {
  const batch = syncBatchSchema.safeParse(body);
  if (!batch.success) throw badRequest("Invalid sync batch");

  const rules = await getRules(db);
  const shift = await getShift(db, staff.shiftId);
  const geofences = await getGeofencesFor(db, staff);
  const driftSec = (now.getTime() - new Date(batch.data.sentAt).getTime()) / 1000;
  const stationSiteId = options.stationSiteId ?? null;
  const ctx: Context = { staff, rules, shift, geofences, driftSec, now, stationSiteId };
  const schema = stationSiteId ? stationEventSchema : incomingEventSchema;

  // Results are returned in the order the phone sent the events; processing is in time order.
  const results: EventResult[] = new Array(batch.data.events.length);
  const prepared: ((Prepared & { index: number }) | null)[] = batch.data.events.map((raw, index) => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const clientEventId =
        raw && typeof raw === "object" && typeof (raw as { clientEventId?: unknown }).clientEventId === "string"
          ? (raw as { clientEventId: string }).clientEventId
          : null;
      results[index] = { clientEventId, status: "REJECTED", code: "INVALID_EVENT", message: "Invalid event data" };
      return null;
    }
    return { ...prepare(parsed.data, ctx), index };
  });

  const valid = prepared
    .filter((p): p is Prepared & { index: number } => !!p)
    .sort((a, b) => a.event.effectiveTime.localeCompare(b.event.effectiveTime));
  if (!valid.length) return results;

  const dates = valid.map((p) => p.event.attendanceDate).sort();
  const holidays = await getHolidaySet(db, dates[0], dates[dates.length - 1]);
  const lockedMonths = new Set<string>();
  for (const month of new Set(dates.map(monthOf))) {
    if ((await getMonthLockState(db, month, rules, now)).locked) lockedMonths.add(month);
  }

  const touched = new Set<LocalDate>();
  for (const item of valid) {
    const result = await storeEvent(db, item, ctx, holidays, lockedMonths);
    results[item.index] = result;
    if (result.status === "ACCEPTED" && (item.event.type === "IN" || item.event.type === "OUT")) {
      touched.add(item.event.attendanceDate);
    }
  }

  for (const date of touched) {
    await recomputeDay(db, staff, date, now, { rules, shift });
  }

  await db
    .collection(COL.deviceHealth)
    .doc(staff.id)
    .set({ staffId: staff.id, deviceId: staff.deviceId, lastSync: now.toISOString() }, { merge: true });

  return results;
}

async function storeEvent(
  db: Db,
  { input, event, refusal }: Prepared,
  ctx: Context,
  holidays: ReadonlySet<string>,
  lockedMonths: ReadonlySet<string>,
): Promise<EventResult> {
  const ref = db.collection(COL.events).doc(event.id);
  const base = { clientEventId: event.clientEventId, attendanceDate: event.attendanceDate };

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      const stored = existing.data() as AttendanceEvent;
      return {
        ...base,
        attendanceDate: stored.attendanceDate,
        status: "DUPLICATE" as const,
        code: stored.status === "REJECTED" ? stored.rejectReason ?? undefined : undefined,
      };
    }

    const reject = (code: string, message: string): EventResult => {
      tx.create(ref, { ...event, status: "REJECTED", rejectReason: code });
      return { ...base, status: "REJECTED", code, message };
    };

    if (refusal) return reject(refusal.code, refusal.message);

    if (lockedMonths.has(monthOf(event.attendanceDate))) {
      event.flags = Array.from(new Set<EventFlag>([...event.flags, "LOCKED_MONTH"])).sort();
      return reject("MONTH_LOCKED", `${monthOf(event.attendanceDate)} is locked; this record was kept for review only.`);
    }

    if (event.type === "OT_IN" || event.type === "OT_OUT") {
      const openSnap = await tx.get(
        db.collection(COL.overtime).where("staffId", "==", ctx.staff.id).where("otOut", "==", null),
      );
      const open = openSnap.docs.map((d) => ({ ...(d.data() as OvertimeRequest), id: d.id }));
      const effective = new Date(event.effectiveTime);
      const dayType = dayTypeOf(event.attendanceDate, ctx.rules, holidays);

      if (event.type === "OT_IN") {
        if (open.length) return reject("OT_ALREADY_OPEN", "You already have overtime in progress. Tap OT Out first.");
        const check = checkOtIn({
          at: effective,
          date: event.attendanceDate,
          shift: ctx.shift,
          rules: ctx.rules,
          dayType,
          insideGeofence: event.insideGeofence,
        });
        if (!check.ok) return reject(check.code, check.message);

        const ot: Omit<OvertimeRequest, "id"> = {
          staffId: ctx.staff.id,
          contractorId: ctx.staff.contractorId,
          supervisorId: ctx.staff.supervisorId,
          supervisor2Id: ctx.staff.supervisor2Id ?? null,
          date: event.attendanceDate,
          month: monthOf(event.attendanceDate),
          dayType,
          rateType: rateTypeFor(event.attendanceDate, dayType, ctx.rules),
          otIn: event.effectiveTime,
          otOut: null,
          otInEventId: event.id,
          otOutEventId: null,
          inPhotoRef: event.photoRef,
          outPhotoRef: null,
          claimedMinutes: null,
          minutes: null,
          reason: input.reason ?? "",
          status: "PENDING",
          autoClosed: false,
          flags: event.flags,
          approverId: null,
          decidedAt: null,
          decisionNote: null,
          reminderAt: null,
          escalatedAt: null,
          createdAt: ctx.now.toISOString(),
        };
        tx.create(db.collection(COL.overtime).doc(event.id), ot);
      } else {
        const current = open[0];
        if (!current) return reject("NO_OPEN_OT", "There is no overtime in progress to close.");
        const otIn = new Date(current.otIn);
        if (effective.getTime() <= otIn.getTime()) return reject("INVALID_TIME", "OT Out must be after OT In.");
        const cutoff = otAutoCloseAt(otIn, ctx.rules);
        const capped = effective.getTime() > cutoff.getTime();
        const otOut = capped ? cutoff : effective;
        const minutes = otMinutes(otIn, otOut, ctx.rules);
        const reason = [current.reason, input.reason].filter(Boolean).join(" | ");
        tx.update(db.collection(COL.overtime).doc(current.id), {
          otOut: otOut.toISOString(),
          otOutEventId: event.id,
          outPhotoRef: event.photoRef,
          claimedMinutes: minutes,
          minutes,
          reason,
          status: capped ? "AUTO_CLOSED" : "PENDING",
          autoClosed: capped,
          flags: Array.from(new Set([...current.flags, ...event.flags])).sort(),
        });
        event.attendanceDate = current.date;
      }
    }

    if (event.type === "OUT") await autoOvertimeFromLateOut(db, tx, event, ctx, holidays);

    tx.create(ref, event);
    return { ...base, attendanceDate: event.attendanceDate, status: "ACCEPTED" };
  });
}

/** QR scan + a GPS fix at least this good and this far from the site = flag for review. */
const QR_RELAY_MAX_ACCURACY_M = 300;
const QR_RELAY_DISTANCE_M = 1000;

const localTime = (iso: string | Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/**
 * A check-out after the overtime start time (shift end + 30 min), or any check-out on a day off,
 * means the staff member worked overtime. It is created — or extended by a later check-out —
 * already approved; the supervisor can still reject it or change the minutes.
 * Overtime the staff member started with OT In (app 1.1) is left alone.
 */
async function autoOvertimeFromLateOut(db: Db, tx: Transaction, event: AttendanceEvent, ctx: Context, holidays: ReadonlySet<string>) {
  const dayType = dayTypeOf(event.attendanceDate, ctx.rules, holidays);
  const out = new Date(event.effectiveTime);
  const tz = ctx.rules.timezone;

  let otIn: Date;
  let reason: string;
  if (dayType === "WORKDAY") {
    const w = shiftWindows(event.attendanceDate, ctx.shift, ctx.rules);
    otIn = w.otAllowedFrom;
    reason = `Checked out at ${localTime(out, tz)}, shift ended ${localTime(w.end, tz)}.`;
  } else {
    if (!ctx.rules.offDayWorkIsOvertime) return;
    const daySnap = await tx.get(
      db.collection(COL.events).where("staffId", "==", ctx.staff.id).where("attendanceDate", "==", event.attendanceDate),
    );
    const firstIn = daySnap.docs
      .map((d) => d.data() as AttendanceEvent)
      .filter((e) => e.type === "IN" && e.status === "ACCEPTED")
      .map((e) => e.effectiveTime)
      .sort()[0];
    if (!firstIn) return;
    otIn = new Date(firstIn);
    reason = `Worked on a ${dayType === "HOLIDAY" ? "holiday" : "day off"}: ${localTime(otIn, tz)} – ${localTime(out, tz)}.`;
  }
  if (out.getTime() <= otIn.getTime()) return;
  const cutoff = otAutoCloseAt(otIn, ctx.rules);
  const capped = out.getTime() > cutoff.getTime();
  const otOut = capped ? cutoff : out;
  const minutes = otMinutes(otIn, otOut, ctx.rules);
  if (minutes <= 0) return;

  const existingSnap = await tx.get(
    db.collection(COL.overtime).where("staffId", "==", ctx.staff.id).where("date", "==", event.attendanceDate),
  );
  const existing = existingSnap.docs.map((d) => ({ ...(d.data() as OvertimeRequest), id: d.id }));
  if (existing.some((o) => !o.flags?.includes("AUTO_DETECTED"))) return;
  const auto = existing[0];
  const decision = {
    status: "APPROVED" as const,
    approverId: SYSTEM_APPROVER,
    decidedAt: ctx.now.toISOString(),
    decisionNote: "Approved automatically from the check-out time.",
  };
  if (auto) {
    // Only extend while untouched by a supervisor.
    const untouched = auto.status === "PENDING" || (auto.status === "APPROVED" && auto.approverId === SYSTEM_APPROVER);
    if (!untouched || !auto.otOut || Date.parse(auto.otOut) >= otOut.getTime()) return;
    tx.update(db.collection(COL.overtime).doc(auto.id), {
      otOut: otOut.toISOString(),
      otOutEventId: event.id,
      claimedMinutes: minutes,
      minutes,
      reason,
      autoClosed: capped,
      ...decision,
    });
    return;
  }
  const ot: Omit<OvertimeRequest, "id"> = {
    staffId: ctx.staff.id,
    contractorId: ctx.staff.contractorId,
    supervisorId: ctx.staff.supervisorId,
    supervisor2Id: ctx.staff.supervisor2Id ?? null,
    date: event.attendanceDate,
    month: monthOf(event.attendanceDate),
    dayType,
    rateType: rateTypeFor(event.attendanceDate, dayType, ctx.rules),
    otIn: otIn.toISOString(),
    otOut: otOut.toISOString(),
    otInEventId: event.id,
    otOutEventId: event.id,
    inPhotoRef: null,
    outPhotoRef: event.photoRef,
    claimedMinutes: minutes,
    minutes,
    reason,
    autoClosed: capped,
    flags: Array.from(new Set<EventFlag>(["AUTO_DETECTED", ...event.flags])).sort(),
    ...decision,
    reminderAt: null,
    escalatedAt: null,
    createdAt: ctx.now.toISOString(),
  };
  tx.create(db.collection(COL.overtime).doc(`auto_${event.id}`), ot);
}
