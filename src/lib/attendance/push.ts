import { createHash } from "node:crypto";
import { z } from "zod";
import type { AttendanceRules } from "./config";
import { badRequest } from "./errors";
import { dayTypeOf, shiftWindows } from "./rules";
import { COL, dayId, getHolidaySet, getShift, listStaff, type Db } from "./store";
import { localDateOf } from "./time";
import type { AttendanceDay, Shift, Staff } from "./types";

/** VAPID keys for Web Push (iPhone check-in reminders). */
export function pushKeys() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY ?? "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY ?? "";
  const subject = process.env.WEB_PUSH_SUBJECT || "mailto:admin@ekkparts.com";
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(5).max(200) }),
});

const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 40);

export async function saveSubscription(db: Db, staff: Staff, body: unknown, now: Date) {
  const parsed = subscriptionSchema.safeParse((body as { subscription?: unknown })?.subscription);
  if (!parsed.success) throw badRequest("Invalid push subscription");
  await db
    .collection(COL.pushSubs)
    .doc(subId(parsed.data.endpoint))
    .set({ staffId: staff.id, deviceId: staff.deviceId ?? "", endpoint: parsed.data.endpoint, keys: parsed.data.keys, createdAt: now.toISOString() });
}

export async function removeSubscription(db: Db, staff: Staff, endpoint: string) {
  const ref = db.collection(COL.pushSubs).doc(subId(endpoint));
  const snap = await ref.get();
  if (snap.exists && snap.get("staffId") === staff.id) await ref.delete();
}

type Reminder = { kind: "in" | "out"; title: string; body: string; url: string };

/** Which reminder (if any) is due for this day right now. */
export function dueReminder(shift: Shift, rules: AttendanceRules, date: string, day: AttendanceDay | null, now: Date, sent: { in?: string; out?: string }): Reminder | null {
  const w = shiftWindows(date, shift, rules);
  const t = now.getTime();
  if (day?.status === "LEAVE") return null;
  if (!day?.firstIn && !sent.in && t >= w.inOpen.getTime() && t < w.inClose.getTime() + 60 * 60000) {
    return { kind: "in", title: "Time to check in", body: `Your shift starts at ${shift.startTime}. Tap to check in.`, url: "/checkin/?action=in" };
  }
  if (day?.firstIn && !day.lastOut && !sent.out && t >= w.outOpen.getTime() && t < w.outClose.getTime()) {
    return { kind: "out", title: "Time to check out", body: `Your shift ends at ${shift.endTime}. Tap to check out before you leave.`, url: "/checkin/?action=out" };
  }
  return null;
}

type Sender = (subscription: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string) => Promise<void>;

async function defaultSender(): Promise<Sender | null> {
  const keys = pushKeys();
  if (!keys) return null;
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  return async (subscription, payload) => {
    await webpush.sendNotification(subscription, payload, { TTL: 1800, urgency: "high" });
  };
}

/** Called every few minutes by an outside scheduler: one check-in and one check-out reminder per iPhone user per day. */
export async function sendDueReminders(db: Db, rules: AttendanceRules, now: Date, sender?: Sender) {
  const send = sender ?? (await defaultSender());
  if (!send) return { sent: 0, skipped: "WEB_PUSH keys not configured" };
  const subsSnap = await db.collection(COL.pushSubs).get();
  if (subsSnap.empty) return { sent: 0 };
  const subsByStaff = new Map<string, { id: string; endpoint: string; keys: { p256dh: string; auth: string } }[]>();
  for (const d of subsSnap.docs) {
    const s = d.data() as { staffId: string; endpoint: string; keys: { p256dh: string; auth: string } };
    subsByStaff.set(s.staffId, [...(subsByStaff.get(s.staffId) ?? []), { id: d.id, endpoint: s.endpoint, keys: s.keys }]);
  }
  const staffList = (await listStaff(db)).filter((s) => s.active && !s.deleted && s.webCheckin && subsByStaff.has(s.id));
  const date = localDateOf(now, rules.timezone);
  const holidays = await getHolidaySet(db, date, date);
  if (dayTypeOf(date, rules, holidays) !== "WORKDAY") return { sent: 0 };

  let sent = 0;
  const shifts = new Map<string, Shift>();
  for (const staff of staffList) {
    if (!shifts.has(staff.shiftId)) shifts.set(staff.shiftId, await getShift(db, staff.shiftId));
    const shift = shifts.get(staff.shiftId)!;
    const [daySnap, logSnap] = await Promise.all([
      db.collection(COL.days).doc(dayId(staff.id, date)).get(),
      db.collection(COL.pushLog).doc(dayId(staff.id, date)).get(),
    ]);
    const day = daySnap.exists ? (daySnap.data() as AttendanceDay) : null;
    const log = (logSnap.exists ? logSnap.data() : {}) as { in?: string; out?: string };
    const reminder = dueReminder(shift, rules, date, day, now, log);
    if (!reminder) continue;
    const payload = JSON.stringify({ title: reminder.title, body: reminder.body, url: reminder.url, tag: `ekk-${reminder.kind}` });
    for (const sub of subsByStaff.get(staff.id) ?? []) {
      try {
        await send({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.collection(COL.pushSubs).doc(sub.id).delete();
      }
    }
    await db.collection(COL.pushLog).doc(dayId(staff.id, date)).set({ ...log, [reminder.kind]: now.toISOString() }, { merge: true });
  }
  return { sent };
}
