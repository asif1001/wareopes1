import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson } from "@/lib/attendance/http";
import { refreshStaffSession } from "@/lib/attendance/mobile-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-refresh", 30);
    const db = await attendanceDb();
    const { tokens } = await refreshStaffSession(db, await readJson(request), new Date());
    return ok({ ...tokens });
  } catch (error) {
    return fail(error);
  }
}
