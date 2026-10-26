import type { NextRequest } from "next/server";
import { addStaffComment } from "@/lib/attendance/corrections";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-comments", 20);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const comments = await addStaffComment(db, staff, await readJson(request), now);
    return ok({ comments });
  } catch (error) {
    return fail(error);
  }
}
