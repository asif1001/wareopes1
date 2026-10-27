import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { listDays } from "@/lib/attendance/reports-service";
import { isValidLocalDate, isValidMonth } from "@/lib/attendance/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?date=YYYY-MM-DD`, `?staffId=…&month=YYYY-MM`, or `?month=YYYY-MM` for every staff member (Excel export, needs "export"). */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams;
    const date = q.get("date") ?? undefined;
    const month = q.get("month") ?? undefined;
    const staffId = q.get("staffId") ?? undefined;
    const actor = await requireActor(month && !staffId ? "export" : "view");
    if (date && !isValidLocalDate(date)) throw badRequest("Date must be YYYY-MM-DD");
    if (month && !isValidMonth(month)) throw badRequest("Month must be YYYY-MM");
    if (!date && !month) throw badRequest("Provide a date or a month");
    return ok({ items: await listDays(await attendanceDb(), actor, { date, month, staffId }) });
  } catch (error) {
    return fail(error);
  }
}
