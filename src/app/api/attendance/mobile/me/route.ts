import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, requireStaff } from "@/lib/attendance/http";
import { getMobileProfile } from "@/lib/attendance/mobile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    limit(request, "att-mobile-me", 60);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    return ok({ profile: await getMobileProfile(db, staff, now) });
  } catch (error) {
    return fail(error);
  }
}
