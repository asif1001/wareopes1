import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson, requireStaff } from "@/lib/attendance/http";
import { ingestEvents } from "@/lib/attendance/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    limit(request, "att-mobile-events", 60);
    const db = await attendanceDb();
    const now = new Date();
    const staff = await requireStaff(request, db, now);
    const results = await ingestEvents(db, staff, await readJson(request), now);
    return ok({ results, serverTime: now.toISOString() });
  } catch (error) {
    return fail(error);
  }
}
