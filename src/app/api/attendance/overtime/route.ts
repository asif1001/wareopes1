import type { NextRequest } from "next/server";
import { scopeStaff } from "@/lib/attendance/actor";
import { badRequest } from "@/lib/attendance/errors";
import { attendanceDb, fail, ok, requireActor } from "@/lib/attendance/http";
import { listOvertime, withEventDetails } from "@/lib/attendance/overtime";
import { listStaff } from "@/lib/attendance/store";
import { isValidMonth } from "@/lib/attendance/time";
import type { OvertimeStatus } from "@/lib/attendance/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: OvertimeStatus[] = ["PENDING", "APPROVED", "REJECTED", "AUTO_CLOSED"];

export async function GET(request: NextRequest) {
  try {
    const actor = await requireActor("view");
    const q = request.nextUrl.searchParams;
    const status = q.get("status") as OvertimeStatus | null;
    const month = q.get("month");
    if (status && !STATUSES.includes(status)) throw badRequest("Unknown status");
    if (month && !isValidMonth(month)) throw badRequest("Month must be YYYY-MM");
    const db = await attendanceDb();
    const ids = new Set(scopeStaff(actor, await listStaff(db)).map((s) => s.id));
    const items = (await listOvertime(db, { status: status ?? undefined, month: month ?? undefined })).filter((o) =>
      ids.has(o.staffId),
    );
    return ok({ items: await withEventDetails(db, items) });
  } catch (error) {
    return fail(error);
  }
}
