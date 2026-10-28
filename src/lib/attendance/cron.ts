import { ensureDays } from "./days";
import { autoLockMonths } from "./locks";
import { autoCloseOvertime, markOvertimeReminders } from "./overtime";
import { purgeExpiredPhotos, type PhotoStore } from "./photos";
import { sendDueReminders } from "./push";
import { COL, getRules, listStaff, type Db } from "./store";

export const REMINDER_STATUS_DOC = "reminderStatus";
import { addDays, localDateOf } from "./time";

/** "reminders" runs every 5 minutes from an outside scheduler (iPhone push reminders); it is not part of "all". */
export const CRON_JOBS = ["days", "overtime", "month-lock", "photo-retention", "reminders", "all"] as const;
export type CronJob = (typeof CRON_JOBS)[number];

/**
 * Scheduled maintenance. Every job is idempotent, so running it late or twice
 * is harmless. Intended to be called every 15 minutes by Cloud Scheduler.
 */
export async function runCron(db: Db, job: CronJob, now: Date, photoStore?: () => Promise<PhotoStore>) {
  const rules = await getRules(db);
  const result: Record<string, unknown> = {};
  const run = (name: CronJob) => job === "all" || job === name;

  if (run("overtime")) {
    result.autoClosed = await autoCloseOvertime(db, rules, now);
    result.reminders = await markOvertimeReminders(db, rules, now);
  }
  if (run("days")) {
    const staff = await listStaff(db);
    const today = localDateOf(now, rules.timezone);
    let count = 0;
    for (const date of [addDays(today, -1), today]) {
      count += (await ensureDays(db, staff, date, now, rules)).length;
    }
    result.daysUpdated = count;
  }
  if (run("month-lock")) {
    result.monthsLocked = await autoLockMonths(db, rules, now);
  }
  if (job === "reminders") {
    const reminders = await sendDueReminders(db, rules, now);
    result.reminders = reminders;
    // Shown on Attendance → Setup so an admin can see the outside scheduler is calling us.
    await db.collection(COL.settings).doc(REMINDER_STATUS_DOC).set({ lastRunAt: now.toISOString(), ...reminders });
  }
  if (run("photo-retention") && photoStore) {
    result.photosDeleted = await purgeExpiredPhotos(db, await photoStore(), rules, now);
  }
  return result;
}
