import { pendingCounts } from "@/lib/attendance/exceptions";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nav badges: overtime and requests waiting for this user's decision. */
export async function GET() {
  try {
    const actor = await requireActor("view");
    const { overtime, requests } = await pendingCounts(await attendanceDb(), actor);
    return ok({ count: overtime + requests, overtime, requests });
  } catch (error) {
    return fail(error);
  }
}
