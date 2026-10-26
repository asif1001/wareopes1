import type { Query } from "firebase-admin/firestore";
import { z } from "zod";
import type { AttendanceRules } from "./config";
import { canApproveOvertime, type Actor } from "./actor";
import { writeAudit, writeAuditInTx } from "./audit";
import { badRequest, conflict, forbidden, notFound } from "./errors";
import { assertDateOpen } from "./locks";
import { otAutoCloseAt, otMinutes } from "./rules";
import { COL, getRules, type Db } from "./store";
import type { AttendanceEvent, OvertimeRequest, OvertimeStatus } from "./types";

export const decisionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "EDIT"]),
    minutes: z.number().int().min(0).max(24 * 60).optional(),
    note: z.string().trim().min(3, "A note is required").max(1000),
  })
  .refine((v) => v.action !== "EDIT" || typeof v.minutes === "number", {
    message: "Minutes are required when editing",
    path: ["minutes"],
  });

const UNDECIDED: OvertimeStatus[] = ["PENDING", "AUTO_CLOSED"];

export async function getOvertime(db: Db, id: string): Promise<OvertimeRequest> {
  const snap = await db.collection(COL.overtime).doc(id).get();
  if (!snap.exists) throw notFound("Overtime request not found");
  return { ...(snap.data() as OvertimeRequest), id: snap.id };
}

/** Approve, reject or approve with edited minutes. A note is always required. */
export async function decideOvertime(db: Db, actor: Actor, id: string, body: unknown, now: Date) {
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid decision");
  const { action, note } = parsed.data;

  const rules = await getRules(db);
  const ot = await getOvertime(db, id);
  if (!canApproveOvertime(actor, ot)) throw forbidden("You are not the approver for this staff member");
  await assertDateOpen(db, ot.date, rules, now);

  const ref = db.collection(COL.overtime).doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = { ...(snap.data() as OvertimeRequest), id };
    if (!UNDECIDED.includes(current.status)) throw conflict("This overtime has already been decided");
    if (!current.otOut) throw conflict("Overtime is still in progress");

    const updates: Partial<OvertimeRequest> = {
      status: action === "REJECT" ? "REJECTED" : "APPROVED",
      minutes: action === "EDIT" ? parsed.data.minutes! : current.minutes,
      approverId: actor.userId,
      decidedAt: now.toISOString(),
      decisionNote: note,
    };
    tx.update(ref, updates);
    writeAuditInTx(
      db,
      tx,
      {
        who: actor.userId,
        what: `OT_${action}`,
        entity: COL.overtime,
        entityId: id,
        before: { status: current.status, minutes: current.minutes },
        after: { status: updates.status, minutes: updates.minutes, note },
      },
      now,
    );
    return { ...current, ...updates };
  });
}

/** Cron: close OT with no OT Out at its cut-off, flagged for review. */
export async function autoCloseOvertime(db: Db, rules: AttendanceRules, now: Date) {
  const open = await db.collection(COL.overtime).where("otOut", "==", null).get();
  const closed: string[] = [];
  for (const doc of open.docs) {
    const ot = doc.data() as OvertimeRequest;
    const cutoff = otAutoCloseAt(new Date(ot.otIn), rules);
    if (now.getTime() < cutoff.getTime()) continue;
    const didClose = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if ((fresh.data() as OvertimeRequest).otOut) return false;
      const minutes = otMinutes(new Date(ot.otIn), cutoff, rules);
      tx.update(doc.ref, {
        otOut: cutoff.toISOString(),
        claimedMinutes: minutes,
        minutes,
        status: "AUTO_CLOSED",
        autoClosed: true,
      });
      return true;
    });
    if (didClose) {
      closed.push(doc.id);
      await writeAudit(
        db,
        { who: "system", what: "OT_AUTO_CLOSED", entity: COL.overtime, entityId: doc.id, before: null, after: { otOut: cutoff.toISOString() } },
        now,
      );
    }
  }
  return closed;
}

/** Cron: mark undecided OT for a reminder after 24 h and escalation after 48 h. */
export async function markOvertimeReminders(db: Db, rules: AttendanceRules, now: Date) {
  const snap = await db.collection(COL.overtime).where("status", "in", UNDECIDED).get();
  const reminded: string[] = [];
  const escalated: string[] = [];
  for (const doc of snap.docs) {
    const ot = doc.data() as OvertimeRequest;
    if (!ot.otOut || ot.decidedAt) continue;
    const ageHours = (now.getTime() - new Date(ot.otOut).getTime()) / 3600000;
    const updates: Partial<OvertimeRequest> = {};
    if (ageHours >= rules.otReminderAfterHours && !ot.reminderAt) {
      updates.reminderAt = now.toISOString();
      reminded.push(doc.id);
    }
    if (ageHours >= rules.otEscalateAfterHours && !ot.escalatedAt) {
      updates.escalatedAt = now.toISOString();
      escalated.push(doc.id);
    }
    if (Object.keys(updates).length) await doc.ref.update(updates);
  }
  return { reminded, escalated };
}

export type OvertimeEventSummary = Pick<
  AttendanceEvent,
  "lat" | "lng" | "accuracyM" | "distanceM" | "insideGeofence" | "flags" | "effectiveTime" | "photoRef"
>;

/** Attach the GPS details of the OT In / OT Out events for the approval screen. */
export async function withEventDetails(db: Db, items: OvertimeRequest[]) {
  const summary = async (id: string | null): Promise<OvertimeEventSummary | null> => {
    if (!id) return null;
    const snap = await db.collection(COL.events).doc(id).get();
    if (!snap.exists) return null;
    const e = snap.data() as AttendanceEvent;
    return {
      lat: e.lat,
      lng: e.lng,
      accuracyM: e.accuracyM,
      distanceM: e.distanceM,
      insideGeofence: e.insideGeofence,
      flags: e.flags,
      effectiveTime: e.effectiveTime,
      photoRef: e.photoRef,
    };
  };
  return Promise.all(
    items.map(async (ot) => ({ ...ot, inEvent: await summary(ot.otInEventId), outEvent: await summary(ot.otOutEventId) })),
  );
}

export async function listOvertime(db: Db, filter: { status?: OvertimeStatus; month?: string; staffId?: string }) {
  let query: Query = db.collection(COL.overtime);
  if (filter.status) query = query.where("status", "==", filter.status);
  if (filter.month) query = query.where("month", "==", filter.month);
  if (filter.staffId) query = query.where("staffId", "==", filter.staffId);
  const snap = await query.get();
  return snap.docs
    .map((d) => ({ ...(d.data() as OvertimeRequest), id: d.id }))
    .sort((a, b) => b.otIn.localeCompare(a.otIn));
}
