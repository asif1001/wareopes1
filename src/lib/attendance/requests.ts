import { z } from "zod";
import { canManageStaff, scopeStaff, type Actor } from "./actor";
import { writeAudit } from "./audit";
import { addCorrection } from "./corrections";
import { recomputeDay } from "./days";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { COL, dayId, getRules, getStaff, listStaff, type Db } from "./store";
import { addDays, isValidLocalDate, localDateOf, zonedToUtc } from "./time";
import type { IsoInstant, LocalDate, Staff } from "./types";

export const REQUEST_TYPES = ["CORRECTION", "LEAVE"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const CORRECTION_KINDS = ["MISSING_IN", "MISSING_OUT", "WRONG_IN", "WRONG_OUT"] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

export const LEAVE_TYPES = ["ANNUAL", "SICK", "EMERGENCY", "OTHER"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** A staff member's request for a time correction or leave; a supervisor decides it. */
export type StaffRequest = {
  id: string;
  staffId: string;
  contractorId: string;
  supervisorId: string;
  supervisor2Id: string | null;
  type: RequestType;
  /** First (or only) day */
  date: LocalDate;
  /** Last day of a leave request (same as `date` for one day) */
  endDate: LocalDate;
  correctionKind: CorrectionKind | null;
  /** "HH:mm" local time the staff member says is right, if known */
  time: string | null;
  leaveType: LeaveType | null;
  reason: string;
  photoRef: string | null;
  status: RequestStatus;
  /** Set when an approved leave request covers these days: `${staffId}_${date}` */
  leaveKeys: string[];
  decidedBy: string | null;
  decidedAt: IsoInstant | null;
  decisionNote: string | null;
  /** Correction record created on approval */
  correctionId: string | null;
  createdAt: IsoInstant;
};

const MAX_LEAVE_DAYS = 31;
const MAX_PENDING = 20;
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");
const idPattern = /^[A-Za-z0-9_-]{8,64}$/;

const createSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CORRECTION"),
    date: z.string().refine(isValidLocalDate, "Invalid date"),
    correctionKind: z.enum(CORRECTION_KINDS),
    time: hhmm.nullable().default(null),
    reason: z.string().trim().min(3, "Please give a reason").max(500),
    photoRef: z.string().regex(idPattern).nullable().default(null),
  }),
  z.object({
    type: z.literal("LEAVE"),
    date: z.string().refine(isValidLocalDate, "Invalid date"),
    endDate: z.string().refine(isValidLocalDate, "Invalid date").optional(),
    leaveType: z.enum(LEAVE_TYPES),
    reason: z.string().trim().min(3, "Please give a reason").max(500),
    photoRef: z.string().regex(idPattern).nullable().default(null),
  }),
]);

function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to && out.length <= MAX_LEAVE_DAYS; d = addDays(d, 1)) out.push(d);
  return out;
}

function toRequest(id: string, data: unknown): StaffRequest {
  return { ...(data as Omit<StaffRequest, "id">), id };
}

/** Staff app: send a request. */
export async function createStaffRequest(db: Db, staff: Staff, body: unknown, now: Date): Promise<StaffRequest> {
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const input = parsed.data;
  const rules = await getRules(db);
  const today = localDateOf(now, rules.timezone);

  let endDate = input.date;
  if (input.type === "CORRECTION") {
    if (input.date > today) throw badRequest("You cannot correct a future day");
    if (input.date < addDays(today, -60)) throw badRequest("That day is too long ago. Ask your supervisor.");
  } else {
    endDate = input.endDate ?? input.date;
    if (endDate < input.date) throw badRequest("The last day must be on or after the first day");
    if (datesBetween(input.date, endDate).length > MAX_LEAVE_DAYS) throw badRequest(`Leave can cover at most ${MAX_LEAVE_DAYS} days per request`);
    if (input.date < addDays(today, -60)) throw badRequest("That day is too long ago. Ask your supervisor.");
  }

  const pending = await db.collection(COL.requests).where("staffId", "==", staff.id).where("status", "==", "PENDING").get();
  if (pending.size >= MAX_PENDING) throw badRequest("You have too many open requests. Wait for your supervisor to answer them.");
  const duplicate = pending.docs
    .map((d) => toRequest(d.id, d.data()))
    .find((r) => r.type === input.type && r.date === input.date && (input.type === "LEAVE" || r.correctionKind === input.correctionKind));
  if (duplicate) throw conflict("You already sent this request. Wait for your supervisor to answer it.");

  const request: Omit<StaffRequest, "id"> = {
    staffId: staff.id,
    contractorId: staff.contractorId,
    supervisorId: staff.supervisorId,
    supervisor2Id: staff.supervisor2Id ?? null,
    type: input.type,
    date: input.date,
    endDate,
    correctionKind: input.type === "CORRECTION" ? input.correctionKind : null,
    time: input.type === "CORRECTION" ? input.time : null,
    leaveType: input.type === "LEAVE" ? input.leaveType : null,
    reason: input.reason,
    photoRef: input.photoRef,
    status: "PENDING",
    leaveKeys: [],
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    correctionId: null,
    createdAt: now.toISOString(),
  };
  const ref = await db.collection(COL.requests).add(request);
  await writeAudit(db, { who: `staff:${staff.id}`, what: "REQUEST_CREATED", entity: COL.requests, entityId: ref.id, before: null, after: request }, now);
  return { ...request, id: ref.id };
}

/** Staff app: own requests, newest first. */
export async function listOwnRequests(db: Db, staff: Staff): Promise<StaffRequest[]> {
  const snap = await db.collection(COL.requests).where("staffId", "==", staff.id).get();
  return snap.docs
    .map((d) => toRequest(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
}

/** Staff app: withdraw a request that has not been decided yet. */
export async function cancelOwnRequest(db: Db, staff: Staff, id: string, now: Date) {
  const ref = db.collection(COL.requests).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Request not found");
  const request = toRequest(snap.id, snap.data());
  if (request.staffId !== staff.id) throw notFound("Request not found");
  if (request.status !== "PENDING") throw conflict("This request was already answered");
  await ref.update({ status: "CANCELLED", decidedAt: now.toISOString() });
  await writeAudit(db, { who: `staff:${staff.id}`, what: "REQUEST_CANCELLED", entity: COL.requests, entityId: id, before: request, after: null }, now);
}

/** WareOps: requests of the staff this user may see. */
export async function listRequests(db: Db, actor: Actor, filter: { status?: RequestStatus | "ALL" }) {
  const visible = new Map(scopeStaff(actor, await listStaff(db)).map((s) => [s.id, s]));
  const snap =
    filter.status && filter.status !== "ALL"
      ? await db.collection(COL.requests).where("status", "==", filter.status).get()
      : await db.collection(COL.requests).get();
  return snap.docs
    .map((d) => toRequest(d.id, d.data()))
    .filter((r) => visible.has(r.staffId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Pending requests this user can decide (nav badge). */
export async function pendingRequestCount(db: Db, actor: Actor, staff: Staff[]) {
  const ids = new Set(staff.filter((s) => canManageStaff(actor, s)).map((s) => s.id));
  if (!ids.size) return 0;
  const snap = await db.collection(COL.requests).where("status", "==", "PENDING").get();
  return snap.docs.filter((d) => ids.has(String(d.get("staffId")))).length;
}

const decisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(500).optional(),
  /** Supervisor may set / fix the time when approving a correction */
  time: hhmm.optional(),
});

function correctionField(kind: CorrectionKind): "firstIn" | "lastOut" {
  return kind === "MISSING_IN" || kind === "WRONG_IN" ? "firstIn" : "lastOut";
}

/** WareOps: approve or reject. Approval writes a normal correction (or marks the leave days) and is audited. */
export async function decideRequest(db: Db, actor: Actor, id: string, body: unknown, now: Date) {
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid decision");
  const ref = db.collection(COL.requests).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("Request not found");
  const request = toRequest(snap.id, snap.data());
  const staff = await getStaff(db, request.staffId);
  if (!canManageStaff(actor, staff)) throw forbidden("You do not supervise this staff member");
  if (request.status !== "PENDING") throw conflict("This request was already answered");
  const { decision, note } = parsed.data;
  if (decision === "REJECT" && !note) throw badRequest("Please tell the staff member why it was rejected");

  const update: Partial<StaffRequest> = {
    status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    decidedBy: actor.userId,
    decidedAt: now.toISOString(),
    decisionNote: note ?? null,
  };

  if (decision === "APPROVE" && request.type === "CORRECTION") {
    const time = parsed.data.time ?? request.time;
    if (!time) throw badRequest("Enter the correct time before approving");
    const rules = await getRules(db);
    const field = correctionField(request.correctionKind!);
    let at = zonedToUtc(request.date, time, rules.timezone);
    if (field === "lastOut") {
      const day = await recomputeDay(db, staff, request.date, now, { rules });
      // Night shifts: an OUT earlier than the IN is on the next calendar day.
      if (day?.firstIn && at.getTime() <= Date.parse(day.firstIn)) at = zonedToUtc(addDays(request.date, 1), time, rules.timezone);
    }
    const { correction } = await addCorrection(
      db,
      actor,
      staff,
      { date: request.date, field, newValue: at.toISOString(), reason: `Staff request: ${request.reason}${note ? ` — ${note}` : ""}` },
      now,
    );
    update.correctionId = correction.id;
    update.time = time;
  }

  if (decision === "APPROVE" && request.type === "LEAVE") {
    update.leaveKeys = datesBetween(request.date, request.endDate).map((d) => dayId(staff.id, d));
  }

  await ref.update(update);
  if (decision === "APPROVE" && request.type === "LEAVE") {
    const rules = await getRules(db);
    const today = localDateOf(now, rules.timezone);
    for (const date of datesBetween(request.date, request.endDate)) {
      if (date <= today) await recomputeDay(db, staff, date, now, { rules });
    }
  }
  const after = { ...request, ...update };
  await writeAudit(db, { who: actor.userId, what: decision === "APPROVE" ? "REQUEST_APPROVED" : "REQUEST_REJECTED", entity: COL.requests, entityId: id, before: request, after }, now);
  return after;
}
