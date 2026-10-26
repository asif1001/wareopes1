import { z } from "zod";
import { MAX_EVENTS_PER_SYNC, type AttendanceRules } from "./config";
import { recomputeDay } from "./days";
import { badRequest } from "./errors";
import { matchGeofence } from "./geo";
import { getMonthLockState } from "./locks";
import { attendanceDateFor, checkOtIn, dayTypeOf, otAutoCloseAt, otMinutes, rateTypeFor } from "./rules";
import { COL, eventId, getGeofencesFor, getHolidaySet, getRules, getShift, type Db } from "./store";
import { monthOf } from "./time";
import {
  EVENT_TRIGGERS,
  EVENT_TYPES,
  type AttendanceEvent,
  type EventFlag,
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
  source: z.enum(["AUTO", "MANUAL"]),
  trigger: z.enum(EVENT_TRIGGERS),
  deviceTime: z.string().datetime({ offset: true }),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  accuracyM: z.number().min(0).max(100000).nullable(),
  mockLocation: z.boolean(),
  rooted: z.boolean().default(false),
  photoRef: z.string().regex(idPattern).nullable().default(null),
  reason: z.string().trim().max(500).optional(),
});

export type IncomingEvent = z.infer<typeof incomingEventSchema>;

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
};

type Prepared = {
  input: IncomingEvent;
  event: AttendanceEvent;
};

function prepare(input: IncomingEvent, ctx: Context): Prepared {
  const { staff, rules, shift, geofences, driftSec, now } = ctx;
  const flags = new Set<EventFlag>();
  let effective = new Date(new Date(input.deviceTime).getTime() + driftSec * 1000);
  if (Math.abs(driftSec) > rules.clockDriftToleranceMin * 60) flags.add("CLOCK_DRIFT");
  if (effective.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    flags.add("FUTURE_TIME");
    effective = now;
  }

  const match = matchGeofence(input.lat, input.lng, input.accuracyM, geofences);
  if (input.lat == null || input.lng == null) flags.add("NO_LOCATION");
  else if (!match.inside) flags.add("OUTSIDE_GEOFENCE");
  if (input.accuracyM != null && input.accuracyM > rules.poorAccuracyM) flags.add("POOR_ACCURACY");
  if (input.mockLocation) flags.add("MOCK_LOCATION");
  if (input.rooted) flags.add("ROOTED");
  if (input.source === "MANUAL") flags.add("MANUAL");

  const id = eventId(staff.id, input.clientEventId);
  return {
    input,
    event: {
      id,
      clientEventId: input.clientEventId,
      staffId: staff.id,
      deviceId: staff.deviceId ?? "",
      type: input.type,
      source: input.source,
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
export async function ingestEvents(db: Db, staff: Staff, body: unknown, now: Date): Promise<EventResult[]> {
  const batch = syncBatchSchema.safeParse(body);
  if (!batch.success) throw badRequest("Invalid sync batch");

  const rules = await getRules(db);
  const shift = await getShift(db, staff.shiftId);
  const geofences = await getGeofencesFor(db, staff);
  const driftSec = (now.getTime() - new Date(batch.data.sentAt).getTime()) / 1000;
  const ctx: Context = { staff, rules, shift, geofences, driftSec, now };

  const results: EventResult[] = [];
  const prepared: (Prepared | null)[] = batch.data.events.map((raw) => {
    const parsed = incomingEventSchema.safeParse(raw);
    if (!parsed.success) {
      const clientEventId =
        raw && typeof raw === "object" && typeof (raw as { clientEventId?: unknown }).clientEventId === "string"
          ? (raw as { clientEventId: string }).clientEventId
          : null;
      results.push({ clientEventId, status: "REJECTED", code: "INVALID_EVENT", message: "Invalid event data" });
      return null;
    }
    return prepare(parsed.data, ctx);
  });

  const valid = prepared.filter((p): p is Prepared => !!p).sort((a, b) =>
    a.event.effectiveTime.localeCompare(b.event.effectiveTime),
  );
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
    results.push(result);
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
  { input, event }: Prepared,
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
          backupApproverId: ctx.staff.backupApproverId ?? null,
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

    tx.create(ref, event);
    return { ...base, attendanceDate: event.attendanceDate, status: "ACCEPTED" };
  });
}
