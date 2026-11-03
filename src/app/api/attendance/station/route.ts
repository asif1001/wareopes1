import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok, readJson } from "@/lib/attendance/http";
import { recordStationScans } from "@/lib/attendance/station";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gate station: record scanned staff QR codes (no login — the station link carries the site's display key). */
export async function POST(request: NextRequest) {
  try {
    limit(request, "att-station", 240);
    const results = await recordStationScans(await attendanceDb(), await readJson(request), new Date());
    return ok({ results });
  } catch (error) {
    return fail(error);
  }
}