import { pendingCounts } from "@/lib/attendance/exceptions";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The badge may be up to this old (it is asked for on every WareOps page). */
const BADGE_MAX_AGE_MS = 60 * 1000;
const recent = new Map<string, { at: number; overtime: number; requests: number }>();

/** Nav badges: overtime and requests waiting for this user's decision. */
export async function GET() {
  try {
    const actor = await requireActor("view");
    const key = `${actor.userId}|${actor.isAdmin}|${actor.reportViewer ? 1 : 0}`;
    let counts = recent.get(key);
    if (!counts || Date.now() - counts.at > BADGE_MAX_AGE_MS) {
      counts = { at: Date.now(), ...(await pendingCounts(await attendanceDb(), actor)) };
      recent.set(key, counts);
    }
    return ok({ count: counts.overtime + counts.requests, overtime: counts.overtime, requests: counts.requests });
  } catch (error) {
    return fail(error);
  }
}
