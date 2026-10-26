import type { NextRequest } from "next/server";
import { canViewStaff } from "@/lib/attendance/actor";
import { badRequest, forbidden } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { COL, getStaff } from "@/lib/attendance/store";
import { isValidLocalDate } from "@/lib/attendance/time";
import type { AttendanceEvent } from "@/lib/attendance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?staffId=…&date=YYYY-MM-DD` — raw events of one attendance day (for review and corrections). */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const staffId = request.nextUrl.searchParams.get("staffId");
    const date = request.nextUrl.searchParams.get("date");
    if (!staffId || !date || !isValidLocalDate(date)) throw badRequest("staffId and date are required");
    const db = await attendanceDb();
    if (!canViewStaff(actor, await getStaff(db, staffId))) throw forbidden();
    const snap = await db.collection(COL.events).where("staffId", "==", staffId).where("attendanceDate", "==", date).get();
    const items = snap.docs
      .map((d) => ({ ...(d.data() as AttendanceEvent), id: d.id }))
      .sort((a, b) => a.effectiveTime.localeCompare(b.effectiveTime));
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}
