import type { NextRequest } from "next/server";
import { recordConsent } from "@/lib/attendance/health";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-consent", 10);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const consent = await recordConsent(db, staff, await readJson(request), now);
    return ok({ consent });
  } catch (error) {
    return fail(error);
  }
}
