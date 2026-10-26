import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, requireStaff } from "@/lib/attendance/http";
import { getStaffHistory } from "@/lib/attendance/mobile";
import { getRules } from "@/lib/attendance/store";
import { localDateOf } from "@/lib/attendance/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    limit(request, "att-mobile-history", 30);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const { timezone } = await getRules(db);
    const month = request.nextUrl.searchParams.get("month") ?? localDateOf(now, timezone).slice(0, 7);
    return ok({ history: await getStaffHistory(db, staff, month) });
  } catch (error) {
    return fail(error);
  }
}
