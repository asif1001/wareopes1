import type { AttendanceRules } from "./config";
import { writeAudit } from "./audit";
import { badRequest, forbidden, locked } from "./errors";
import { COL, type Db } from "./store";
import { localDateOf, monthOf, nextMonth } from "./time";
import type { LocalDate, MonthLock } from "./types";

/** First local date on which `month` locks automatically. */
export function autoLockDate(month: string, rules: AttendanceRules): LocalDate {
  return `${nextMonth(month)}-${String(rules.monthLockDay).padStart(2, "0")}`;
}

export function isLockedByRule(month: string, rules: AttendanceRules, now: Date): boolean {
  return localDateOf(now, rules.timezone) >= autoLockDate(month, rules);
}

/**
 * An explicit lock document wins (so an admin unlock overrides the automatic
 * lock); without one, the month locks on `monthLockDay` of the next month.
 */
export async function getMonthLockState(db: Db, month: string, rules: AttendanceRules, now: Date) {
  const snap = await db.collection(COL.monthLocks).doc(month).get();
  const doc = snap.exists ? (snap.data() as MonthLock) : null;
  const isLocked = doc ? doc.locked : isLockedByRule(month, rules, now);
  return { month, locked: isLocked, doc, autoLockDate: autoLockDate(month, rules) };
}

export async function assertDateOpen(db: Db, date: LocalDate, rules: AttendanceRules, now: Date) {
  const state = await getMonthLockState(db, monthOf(date), rules, now);
  if (state.locked) throw locked(`${monthOf(date)} is locked. Ask an admin to unlock it first.`);
}

export async function lockMonth(db: Db, actorId: string, month: string, now: Date) {
  const ref = db.collection(COL.monthLocks).doc(month);
  const before = (await ref.get()).data() ?? null;
  const after: MonthLock = {
    month,
    locked: true,
    lockedAt: now.toISOString(),
    lockedBy: actorId,
    unlockedAt: (before as MonthLock | null)?.unlockedAt ?? null,
    unlockedBy: (before as MonthLock | null)?.unlockedBy ?? null,
    unlockReason: (before as MonthLock | null)?.unlockReason ?? null,
  };
  await ref.set(after);
  await writeAudit(db, { who: actorId, what: "MONTH_LOCKED", entity: COL.monthLocks, entityId: month, before, after }, now);
  return after;
}

export async function unlockMonth(
  db: Db,
  actor: { userId: string; isAdmin: boolean },
  month: string,
  reason: string,
  now: Date,
) {
  if (!actor.isAdmin) throw forbidden("Only an admin can unlock a month");
  if (!reason?.trim()) throw badRequest("A reason is required to unlock a month");
  const ref = db.collection(COL.monthLocks).doc(month);
  const before = (await ref.get()).data() ?? null;
  const after: MonthLock = {
    month,
    locked: false,
    lockedAt: (before as MonthLock | null)?.lockedAt ?? null,
    lockedBy: (before as MonthLock | null)?.lockedBy ?? null,
    unlockedAt: now.toISOString(),
    unlockedBy: actor.userId,
    unlockReason: reason.trim(),
  };
  await ref.set(after);
  await writeAudit(
    db,
    { who: actor.userId, what: "MONTH_UNLOCKED", entity: COL.monthLocks, entityId: month, before, after },
    now,
  );
  return after;
}

/** Cron: write the lock document for months whose lock day has passed. */
export async function autoLockMonths(db: Db, rules: AttendanceRules, now: Date) {
  const previous = shiftMonth(monthOf(localDateOf(now, rules.timezone)), -1);
  const locked: string[] = [];
  for (const month of [shiftMonth(previous, -1), previous]) {
    if (!isLockedByRule(month, rules, now)) continue;
    const ref = db.collection(COL.monthLocks).doc(month);
    if ((await ref.get()).exists) continue;
    await lockMonth(db, "system", month, now);
    locked.push(month);
  }
  return locked;
}

function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7);
}
