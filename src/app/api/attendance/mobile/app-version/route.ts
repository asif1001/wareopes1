import type { NextRequest } from "next/server";
import { attendanceDb, fail, limit, ok } from "@/lib/attendance/http";
import { appVersionInfo } from "@/lib/attendance/mobile";
import { getRules } from "@/lib/attendance/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: lets the app check for an update before login. */
export async function GET(request: NextRequest) {
  try {
    limit(request, "att-mobile-version", 30);
    const rules = await getRules(await attendanceDb());
    return ok({ app: appVersionInfo(rules) });
  } catch (error) {
    return fail(error);
  }
}
