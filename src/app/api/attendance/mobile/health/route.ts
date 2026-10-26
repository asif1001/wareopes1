import type { NextRequest } from "next/server";
import { reportDeviceHealth } from "@/lib/attendance/health";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-health", 30);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    await reportDeviceHealth(db, staff, await readJson(request), now);
    return ok();
  } catch (error) {
    return fail(error);
  }
}
