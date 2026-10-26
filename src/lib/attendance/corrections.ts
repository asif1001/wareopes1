import { z } from "zod";
import { canManageStaff, type Actor } from "./actor";
import { writeAudit } from "./audit";
import { recomputeDay } from "./days";
import { badRequest, forbidden, notFound } from "./errors";
import { assertDateOpen } from "./locks";
import { COL, dayId, getRules, type Db } from "./store";
import { isValidLocalDate, localDateOf } from "./time";
import { CORRECTION_FIELDS, DAY_STATUSES, type AttendanceDay, type Correction, type Staff } from "./types";

export const correctionSchema = z
  .object({
    date: z.string().refine(isValidLocalDate, "Invalid date"),
    field: z.enum(CORRECTION_FIELDS),
    newValue: z.union([z.string(), z.boolean(), z.null()]),
    reason: z.string().trim().min(3, "A reason is required").max(1000),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ["newValue"] });
    if (v.field === "firstIn" || v.field === "lastOut") {
      if (v.newValue !== null && (typeof v.newValue !== "string" || Number.isNaN(Date.parse(v.newValue)))) {
        fail("Time must be an ISO date-time or empty");
      }
    } else if (v.field === "status") {
      if (typeof v.newValue !== "string" || !(DAY_STATUSES as readonly string[]).includes(v.newValue)) {
        fail("Unknown status");
      }
    } else if (typeof v.newValue !== "boolean") {
      fail("Leave must be true or false");
    }
  });

function currentValue(day: AttendanceDay | null, field: Correction["field"]): Correction["oldValue"] {
  if (!day) return null;
  if (field === "leave") return day.status === "LEAVE";
  return day[field] ?? null;
}

/**
 * Add a supervisor correction. Corrections are separate records; the event
 * data and the computed values on the day are never overwritten.
 */
export async function addCorrection(db: Db, actor: Actor, staff: Staff, body: unknown, now: Date) {
  const parsed = correctionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid correction");
  if (!canManageStaff(actor, staff)) throw forbidden("You do not supervise this staff member");
  const { date, field, reason } = parsed.data;
  const newValue = field === "firstIn" || field === "lastOut"
    ? parsed.data.newValue === null ? null : new Date(parsed.data.newValue as string).toISOString()
    : parsed.data.newValue;

  const rules = await getRules(db);
  if (date > localDateOf(now, rules.timezone)) throw badRequest("Cannot correct a future date");
  await assertDateOpen(db, date, rules, now);

  const before = await recomputeDay(db, staff, date, now, { rules });
  const correction: Omit<Correction, "id"> = {
    attendanceDayId: dayId(staff.id, date),
    staffId: staff.id,
    date,
    field,
    oldValue: currentValue(before, field),
    newValue,
    reason,
    editedBy: actor.userId,
    approvedBy: actor.userId,
    createdAt: now.toISOString(),
  };
  const ref = await db.collection(COL.corrections).add(correction);
  const after = await recomputeDay(db, staff, date, now, { rules });

  await writeAudit(
    db,
    {
      who: actor.userId,
      what: "DAY_CORRECTED",
      entity: COL.days,
      entityId: correction.attendanceDayId,
      before: before ? { status: before.status, firstIn: before.firstIn, lastOut: before.lastOut, regularMinutes: before.regularMinutes } : null,
      after: after ? { status: after.status, firstIn: after.firstIn, lastOut: after.lastOut, regularMinutes: after.regularMinutes, correctionId: ref.id } : null,
    },
    now,
  );
  return { correction: { ...correction, id: ref.id }, day: after };
}

export async function listCorrections(db: Db, staffId: string, date: string) {
  const snap = await db.collection(COL.corrections).where("staffId", "==", staffId).where("date", "==", date).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as Correction), id: d.id }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const commentSchema = z.object({
  date: z.string().refine(isValidLocalDate, "Invalid date"),
  text: z.string().trim().min(1).max(500),
});

const MAX_COMMENTS_PER_DAY = 10;

/** Staff explanation on one of their own days (e.g. "phone battery died"). */
export async function addStaffComment(db: Db, staff: Staff, body: unknown, now: Date) {
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) throw badRequest("Date and comment are required");
  const rules = await getRules(db);
  await assertDateOpen(db, parsed.data.date, rules, now);
  const ref = db.collection(COL.days).doc(dayId(staff.id, parsed.data.date));
  const snap = await ref.get();
  if (!snap.exists) throw notFound("No attendance record for that day");
  const day = snap.data() as AttendanceDay;
  const comments = day.staffComments ?? [];
  if (comments.length >= MAX_COMMENTS_PER_DAY) throw badRequest("Too many comments for this day");
  const updated = [...comments, { text: parsed.data.text, at: now.toISOString() }];
  await ref.update({ staffComments: updated });
  return updated;
}
