import { pendingCount } from "@/lib/attendance/exceptions";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Nav badge: overtime waiting for this user's decision. */
export async function GET() {
  try {
    const actor = await requireActor("view");
    return ok({ count: await pendingCount(await attendanceDb(), actor) });
  } catch (error) {
    return fail(error);
  }
}
