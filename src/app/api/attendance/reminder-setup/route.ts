import type { NextRequest } from "next/server";
import { writeAudit } from "@/lib/attendance/audit";
import { REMINDER_STATUS_DOC } from "@/lib/attendance/cron";
import { forbidden } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { pushKeys, sendDueReminders } from "@/lib/attendance/push";
import { COL, getRules } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminActor() {
  const actor = await requireActor("view");
  if (!actor.isAdmin) throw forbidden("Only an admin can see the reminder setup");
  return actor;
}

/**
 * Admin only: iPhone page link, Android download, and the cron-job.org settings for reminders.
 * The reminder key is returned only with `?reveal=1`, and every reveal is audited.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor();
    const db = await attendanceDb();
    const origin = request.nextUrl.origin;
    const reveal = request.nextUrl.searchParams.get("reveal") === "1";
    const [rules, status] = await Promise.all([getRules(db), db.collection(COL.settings).doc(REMINDER_STATUS_DOC).get()]);
    const key = process.env.REMINDER_CRON_SECRET ?? "";
    if (reveal && key) {
      await writeAudit(db, { who: actor.userId, what: "REMINDER_KEY_VIEWED", entity: COL.settings, entityId: REMINDER_STATUS_DOC, before: null, after: null }, new Date());
    }
    return ok({
      checkinUrl: `${origin}/checkin`,
      apkUrl: rules.apkUrl,
      latestAppVersion: rules.latestAppVersion,
      cron: {
        url: `${origin}/api/attendance/cron?job=reminders`,
        method: "GET",
        headerName: "X-Cron-Secret",
        configured: !!key,
        key: reveal ? key : null,
        everyMinutes: 5,
      },
      pushConfigured: !!pushKeys(),
      lastRun: status.exists ? status.data() : null,
    });
  } catch (error) {
    return fail(error);
  }
}

/** Admin only: send any reminders that are due right now (to check the setup works). */
export async function POST() {
  try {
    await requireAdminActor();
    const db = await attendanceDb();
    const now = new Date();
    const result = await sendDueReminders(db, await getRules(db), now);
    await db.collection(COL.settings).doc(REMINDER_STATUS_DOC).set({ lastRunAt: now.toISOString(), ...result, manual: true });
    return ok({ result });
  } catch (error) {
    return fail(error);
  }
}
