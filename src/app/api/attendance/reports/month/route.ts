import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { getMonthReport } from "@/lib/attendance/reports-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `?month=YYYY-MM[&contractorId=…]` — only APPROVED overtime is included. */
export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const month = request.nextUrl.searchParams.get("month");
    if (!month) throw badRequest("month is required");
    const contractorId = request.nextUrl.searchParams.get("contractorId") ?? undefined;
    const report = await getMonthReport(await attendanceDb(), actor, month, new Date(), contractorId);
    return ok({ report });
  } catch (error) {
    return fail(error);
  }
}
