import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { getMonthLockState, lockMonth, unlockMonth } from "@/lib/attendance/locks";
import { getRules } from "@/lib/attendance/store";
import { isValidMonth } from "@/lib/attendance/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireActor("view");
    const month = request.nextUrl.searchParams.get("month");
    if (!isValidMonth(month)) throw badRequest("Month must be YYYY-MM");
    const db = await attendanceDb();
    return ok({ lock: await getMonthLockState(db, month, await getRules(db), new Date()) });
  } catch (error) {
    return fail(error);
  }
}

/** Body: `{ month, action: "lock" | "unlock", reason? }` — unlock is admin-only and needs a reason. */
export async function POST(request: NextRequest) {
  try {
    const body = (await readJson(request)) as { month?: unknown; action?: unknown; reason?: unknown } | null;
    if (!isValidMonth(body?.month)) throw badRequest("Month must be YYYY-MM");
    const actor = await requireActor("edit");
    const db = await attendanceDb();
    const now = new Date();
    if (body?.action === "lock") return ok({ lock: await lockMonth(db, actor.userId, body.month as string, now) });
    if (body?.action === "unlock") {
      const lock = await unlockMonth(db, actor, body.month as string, String(body.reason ?? ""), now);
      return ok({ lock });
    }
    throw badRequest("Action must be lock or unlock");
  } catch (error) {
    return fail(error);
  }
}