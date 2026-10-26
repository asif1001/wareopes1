import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/attendance/errors";
import { getDailyExceptions } from "@/lib/attendance/exceptions";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { getRules } from "@/lib/attendance/store";
import { isValidLocalDate, localDateOf } from "@/lib/attendance/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const db = await attendanceDb();
    const now = new Date();
    const date = request.nextUrl.searchParams.get("date") ?? localDateOf(now, (await getRules(db)).timezone);
    if (!isValidLocalDate(date)) throw badRequest("Date must be YYYY-MM-DD");
    return ok({ exceptions: await getDailyExceptions(db, actor, date, now) });
  } catch (error) {
    return fail(error);
  }
}
