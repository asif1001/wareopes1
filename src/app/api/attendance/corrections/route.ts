import type { NextRequest } from "next/server";
import { canViewStaff } from "@/lib/attendance/actor";
import { addCorrection, listCorrections } from "@/lib/attendance/corrections";
import { badRequest, forbidden } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, readJson, requireActor } from "@/lib/attendance/http";
import { getStaff } from "@/lib/attendance/store";
import { isValidLocalDate } from "@/lib/attendance/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const staffId = request.nextUrl.searchParams.get("staffId");
    const date = request.nextUrl.searchParams.get("date");
    if (!staffId || !date || !isValidLocalDate(date)) throw badRequest("staffId and date are required");
    const db = await attendanceDb();
    if (!canViewStaff(actor, await getStaff(db, staffId))) throw forbidden();
    return ok({ items: await listCorrections(db, staffId, date) });
  } catch (error) {
    return fail(error);
  }
}

/** Body: `{ staffId, date, field: "firstIn"|"lastOut"|"status"|"leave", newValue, reason }` */
export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor("edit");
    const body = (await readJson(request)) as { staffId?: unknown } | null;
    if (!body || typeof body.staffId !== "string") throw badRequest("staffId is required");
    const db = await attendanceDb();
    const result = await addCorrection(db, actor, await getStaff(db, body.staffId), body, new Date());
    return ok(result, 201);
  } catch (error) {
    return fail(error);
  }
}
